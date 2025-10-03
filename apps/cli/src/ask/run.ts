import type { ProviderId } from '@agi-cli/providers';
import type { Artifact } from '@agi-cli/sdk';
import { renderMarkdown } from '../ui.ts';
import {
	bold,
	dim,
	printPlan,
	printSummary,
	printToolCall,
	printToolResult,
	logToolError,
} from './render.ts';
import {
	computeAssistantLines,
	computeAssistantSegments,
	extractFilesFromPatch,
	buildSequence,
	summarizeTools,
	collectDiffArtifacts,
} from './transcript.ts';
import type {
	AskOptions,
	AskHandshake,
	AssistantChunk,
	ToolCallRecord,
	ToolResultRecord,
	TokenUsageSummary,
	Transcript,
} from './types.ts';
import { connectSSE, httpJson, safeJson } from './http.ts';
import { startEphemeralServer, stopEphemeralServer } from './server.ts';

const READ_ONLY_TOOLS = new Set([
	'read',
	'ls',
	'tree',
	'ripgrep',
	'git_diff',
	'git_status',
]);

const MUTATING_TOOLS = new Set(['write', 'apply_patch', 'edit']);

function extractToolErrorMessage(
	topLevelError: string | undefined,
	resultObject: Record<string, unknown> | null,
): string | undefined {
	const primary = typeof topLevelError === 'string' ? topLevelError.trim() : '';
	if (primary.length) return primary;
	if (!resultObject) return undefined;
	const keys = ['error', 'stderr', 'message', 'detail', 'details', 'reason'];
	for (const key of keys) {
		const value = resultObject[key];
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.length) return trimmed;
		}
	}
	return undefined;
}

export async function runAsk(prompt: string, opts: AskOptions = {}) {
	const startedAt = Date.now();
	const projectRoot = opts.project ?? process.cwd();
	const baseUrl = process.env.AGI_SERVER_URL
		? String(process.env.AGI_SERVER_URL)
		: await startEphemeralServer();

	const flags = parseFlags(process.argv);
	const jsonMode = flags.jsonEnabled || flags.jsonStreamEnabled;

	let sse: SSEConnection | null = null;
	try {
		const handshake = await httpJson<AskHandshake>(
			'POST',
			`${baseUrl}/v1/ask?project=${encodeURIComponent(projectRoot)}`,
			{
				prompt,
				agent: opts.agent,
				provider: opts.provider,
				model: opts.model,
				sessionId: opts.sessionId,
				last: opts.last,
				jsonMode,
			},
		);

		announceContext({
			opts,
			header: handshake.header,
			defaults: {
				agent: handshake.agent,
				provider: handshake.provider,
				model: handshake.model,
			},
			jsonMode,
		});

		if (handshake.message && !jsonMode) {
			const label =
				handshake.message.kind === 'created'
					? 'Created new session'
					: 'Using last session';
			Bun.write(Bun.stderr, `${dim(label)} ${handshake.message.sessionId}\n\n`);
		}

		const sseUrl = `${baseUrl}/v1/sessions/${encodeURIComponent(handshake.sessionId)}/stream?project=${encodeURIComponent(projectRoot)}`;
		sse = await connectSSE(sseUrl);

		const streamResult = await consumeAskStream({
			sse,
			assistantMessageId: handshake.assistantMessageId,
			jsonEnabled: flags.jsonEnabled,
			jsonStreamEnabled: flags.jsonStreamEnabled,
			verbose: flags.verbose,
			readVerbose: flags.readVerbose,
		});
		sse = null;

		if (flags.jsonStreamEnabled) return;

		if (flags.jsonEnabled) {
			const { toolCounts, toolTimings, totalToolTimeMs } = summarizeTools(
				streamResult.toolCalls,
				streamResult.toolResults,
			);
			const assistantLines = computeAssistantLines(
				streamResult.assistantChunks,
			);
			const assistantSegments = computeAssistantSegments(
				streamResult.assistantChunks,
				streamResult.toolCalls,
			);
			const transcript: Transcript = {
				sessionId: handshake.sessionId,
				assistantMessageId: handshake.assistantMessageId,
				agent: handshake.agent,
				provider: handshake.provider,
				model: handshake.model,
				sequence: buildSequence({
					prompt,
					assistantSegments,
					toolCalls: streamResult.toolCalls,
					toolResults: streamResult.toolResults,
				}),
				filesTouched: Array.from(streamResult.filesTouched),
				summary: {
					toolCounts,
					toolTimings,
					totalToolTimeMs,
					filesTouched: Array.from(streamResult.filesTouched),
					diffArtifacts: collectDiffArtifacts(streamResult.toolResults),
					tokenUsage: streamResult.tokenUsage ?? undefined,
				},
				finishReason: streamResult.finishReason,
			};
			if (flags.jsonVerbose) {
				transcript.output = streamResult.output;
				transcript.assistantChunks = streamResult.assistantChunks;
				transcript.assistantLines = assistantLines;
				transcript.assistantSegments = assistantSegments;
				transcript.tools = {
					calls: streamResult.toolCalls,
					results: streamResult.toolResults,
				};
			}
			Bun.write(Bun.stdout, `${JSON.stringify(transcript, null, 2)}\n`);
			return;
		}

		if (
			streamResult.assistantChunks.length === 0 &&
			streamResult.output.trim().length
		) {
			Bun.write(Bun.stderr, `${renderMarkdown(streamResult.output)}\n`);
		}

		if (
			flags.summaryEnabled ||
			streamResult.finishSeen ||
			streamResult.toolCalls.length
		) {
			printSummary(
				streamResult.toolCalls,
				streamResult.toolResults,
				streamResult.filesTouched,
				streamResult.tokenUsage,
			);
		}

		Bun.write(Bun.stderr, `${dim(`Done in ${Date.now() - startedAt}ms`)}\n`);
	} finally {
		try {
			await sse?.close();
		} catch {}
		await maybeStopEphemeral();
	}
}

async function maybeStopEphemeral() {
	if (!process.env.AGI_SERVER_URL) await stopEphemeralServer();
}

type StreamState = {
	output: string;
	assistantChunks: AssistantChunk[];
	toolCalls: ToolCallRecord[];
	toolResults: ToolResultRecord[];
	filesTouched: Set<string>;
	tokenUsage: TokenUsageSummary | null;
	finishReason?: string;
	finishSeen: boolean;
};

type SSEConnection = Awaited<ReturnType<typeof connectSSE>>;

type StreamFlags = {
	sse: SSEConnection;
	assistantMessageId: string;
	jsonEnabled: boolean;
	jsonStreamEnabled: boolean;
	verbose: boolean;
	readVerbose: boolean;
};

async function consumeAskStream(flags: StreamFlags): Promise<StreamState> {
	const sse = flags.sse;
	const state: StreamState = {
		output: '',
		assistantChunks: [],
		toolCalls: [],
		toolResults: [],
		filesTouched: new Set(),
		tokenUsage: null,
		finishSeen: false,
	};
	const callById = new Map<string, number>();

	try {
		for await (const ev of sse) {
			const event = ev.event;
			if (event === 'message.part.delta') {
				handleAssistantDelta(ev.data);
			} else if (event === 'tool.call') {
				handleToolCall(ev.data);
			} else if (event === 'tool.delta') {
				handleToolDelta(ev.data);
			} else if (event === 'tool.result') {
				handleToolResult(ev.data);
			} else if (event === 'plan.updated') {
				handlePlan(ev.data);
			} else if (event === 'message.completed') {
				if (handleCompleted(ev.data)) break;
			} else if (event === 'error') {
				handleError(ev.data);
			}
		}
	} finally {
		await sse.close();
	}

	// Render markdown if we buffered the output
	// Default to streaming for real-time feedback
	const useMarkdownBuffer = process.env.AGI_RENDER_MARKDOWN === '1';
	if (
		useMarkdownBuffer &&
		state.output.length &&
		!flags.jsonEnabled &&
		!flags.jsonStreamEnabled
	) {
		Bun.write(Bun.stdout, `${renderMarkdown(state.output)}\n`);
	} else if (
		state.output.length &&
		!flags.jsonEnabled &&
		!flags.jsonStreamEnabled
	) {
		// Just add newline if we streamed the output
		Bun.write(Bun.stdout, '\n');
	}

	return state;

	function handleAssistantDelta(raw: string) {
		const data = safeJson(raw);
		const messageId =
			typeof data?.messageId === 'string' ? data.messageId : undefined;
		const delta = typeof data?.delta === 'string' ? data.delta : undefined;
		if (messageId !== flags.assistantMessageId || !delta) return;
		state.output += delta;
		const ts = Date.now();
		state.assistantChunks.push({ ts, delta });
		if (flags.jsonStreamEnabled) {
			Bun.write(
				Bun.stdout,
				`${JSON.stringify({
					event: 'assistant.delta',
					ts,
					messageId: flags.assistantMessageId,
					delta,
				})}\n`,
			);
		} else if (!flags.jsonEnabled) {
			// Check if we should buffer for markdown rendering
			// Default to streaming for real-time feedback
			const useMarkdownBuffer = process.env.AGI_RENDER_MARKDOWN === '1';
			if (!useMarkdownBuffer) {
				// Stream raw output for real-time display (default)
				Bun.write(Bun.stdout, delta);
			}
			// If buffering, output will be rendered after completion
		}
	}

	function handleToolCall(raw: string) {
		const data = safeJson(raw);
		const name = typeof data?.name === 'string' ? data.name : 'tool';
		const callId = typeof data?.callId === 'string' ? data.callId : undefined;
		const ts = Date.now();
		state.toolCalls.push({ name, args: data?.args, callId, ts });
		if (callId) callById.set(callId, state.toolCalls.length - 1);
		if (flags.jsonStreamEnabled) {
			Bun.write(
				Bun.stdout,
				`${JSON.stringify({
					event: 'tool.call',
					ts,
					name,
					callId,
					args: data?.args,
				})}\n`,
			);
		} else if (!flags.jsonEnabled) {
			printToolCall(name, data?.args, { verbose: flags.verbose });
		}
	}

	function handleToolDelta(raw: string) {
		const data = safeJson(raw);
		const name = typeof data?.name === 'string' ? data.name : 'tool';
		const channel = typeof data?.channel === 'string' ? data.channel : 'output';
		if (flags.jsonStreamEnabled) {
			const ts = Date.now();
			Bun.write(
				Bun.stdout,
				`${JSON.stringify({
					event: 'tool.delta',
					ts,
					name,
					channel,
					delta: data?.delta,
				})}\n`,
			);
			return;
		}
		if (flags.jsonEnabled) return;
		const isReadOnly = READ_ONLY_TOOLS.has(name);
		if (channel === 'input' && !flags.verbose) return;
		if (isReadOnly && !flags.verbose && !flags.readVerbose) return;
		const delta =
			typeof data?.delta === 'string'
				? data.delta
				: JSON.stringify(data?.delta);
		if (!delta) return;
		Bun.write(
			Bun.stderr,
			`${dim(`[${channel}]`)} ${name} ${dim('›')} ${truncate(delta, 160)}\n`,
		);
	}

	function handleToolResult(raw: string) {
		const data = safeJson(raw);
		const name = typeof data?.name === 'string' ? data.name : 'tool';
		const callId = typeof data?.callId === 'string' ? data.callId : undefined;
		const ts = Date.now();
		let durationMs: number | undefined;
		if (callId) {
			const idx = callById.get(callId);
			if (idx !== undefined) {
				const started = state.toolCalls[idx]?.ts;
				if (typeof started === 'number') durationMs = Math.max(0, ts - started);
			}
		}
		const artifact = data?.artifact as
			| { kind?: string; patch?: string }
			| undefined;
		state.toolResults.push({
			name,
			result: data?.result,
			artifact: artifact as unknown as Artifact,
			callId,
			ts,
			durationMs,
		});
		if (artifact?.kind === 'file_diff' && typeof artifact.patch === 'string') {
			for (const f of extractFilesFromPatch(artifact.patch))
				state.filesTouched.add(f);
		}
		const resultValue = data?.result as { path?: unknown } | undefined;
		const resultObject =
			data?.result &&
			typeof data.result === 'object' &&
			!Array.isArray(data.result)
				? (data.result as Record<string, unknown>)
				: null;
		const topLevelError =
			typeof data?.error === 'string' && data.error.trim().length
				? data.error
				: undefined;
		// Special handling for apply_patch which uses 'ok' field
		const isApplyPatchOk =
			name === 'apply_patch' &&
			resultObject &&
			Reflect.get(resultObject, 'ok') === true;

		const hasErrorResult =
			Boolean(
				resultObject &&
					// Don't treat apply_patch as error if ok is true, even if it has error field
					!(name === 'apply_patch' && isApplyPatchOk) &&
					(Reflect.has(resultObject, 'error') ||
						Reflect.get(resultObject, 'success') === false ||
						(name === 'apply_patch' &&
							Reflect.get(resultObject, 'ok') === false)),
			) || Boolean(topLevelError);
		if (name === 'write' && typeof resultValue?.path === 'string')
			state.filesTouched.add(String(resultValue.path));
		if (flags.jsonStreamEnabled) {
			Bun.write(
				Bun.stdout,
				`${JSON.stringify({
					event: 'tool.result',
					ts,
					name,
					callId,
					durationMs,
					result: data?.result,
					artifact: data?.artifact,
				})}\n`,
			);
			return;
		}
		if (flags.jsonEnabled) return;
		const isReadOnly = READ_ONLY_TOOLS.has(name);
		const hasDiffArtifact = artifact?.kind === 'file_diff';
		const shouldRenderResult =
			name === 'progress_update'
				? false
				: name === 'finish' ||
					name === 'tree' ||
					MUTATING_TOOLS.has(name) ||
					name === 'bash' ||
					hasDiffArtifact ||
					hasErrorResult ||
					((flags.readVerbose || flags.verbose) && isReadOnly);
		const errorMessage = hasErrorResult
			? (extractToolErrorMessage(topLevelError, resultObject) ??
				'Tool reported an error')
			: undefined;
		const resultPayload =
			hasErrorResult && !data?.result
				? { error: errorMessage ?? 'Tool reported an error' }
				: data?.result;
		if (shouldRenderResult) {
			printToolResult(name, resultPayload, artifact, {
				verbose: flags.verbose,
				durationMs,
				error: errorMessage,
				args: data?.args,
			});
		} else if (
			name !== 'progress_update' &&
			data?.error &&
			typeof data.error === 'string' &&
			data.error.trim().length
		) {
			const msg = errorMessage ?? data.error.trim();
			logToolError(name, msg, { durationMs });
		} else if (
			!shouldRenderResult &&
			name !== 'progress_update' &&
			errorMessage &&
			!data?.error
		) {
			logToolError(name, errorMessage, { durationMs });
		} else if (
			name !== 'progress_update' &&
			(!isReadOnly || flags.readVerbose || flags.verbose)
		) {
			const timeStr =
				typeof durationMs === 'number' ? ` ${dim(`(${durationMs}ms)`)} ` : ' ';
			Bun.write(
				Bun.stderr,
				`${bold('›')} ${name}${dim('›')} done${timeStr}\n\n`,
			);
		}
		if (name === 'finish') state.finishSeen = true;
	}

	function handlePlan(raw: string) {
		if (flags.jsonEnabled || flags.jsonStreamEnabled) return;
		const data = safeJson(raw);
		printPlan(data?.items, data?.note);
	}

	function handleCompleted(raw: string) {
		const data = safeJson(raw);
		const completedId = typeof data?.id === 'string' ? data.id : undefined;
		if (completedId !== flags.assistantMessageId) return false;
		const usage = data?.usage as Record<string, unknown> | undefined;
		const candidate = mergeTokenUsage(usage, data?.costUsd, data?.finishReason);
		if (candidate) state.tokenUsage = candidate;
		if (
			typeof data?.finishReason === 'string' &&
			data.finishReason.trim().length
		)
			state.finishReason = data.finishReason.trim();
		if (flags.jsonStreamEnabled) {
			const payload: Record<string, unknown> = {
				event: 'assistant.completed',
				ts: Date.now(),
				messageId: flags.assistantMessageId,
			};
			if (state.tokenUsage) payload.usage = state.tokenUsage;
			Bun.write(Bun.stdout, `${JSON.stringify(payload)}\n`);
		}
		return true;
	}

	function handleError(raw: string) {
		const data = safeJson(raw);
		let errorMessage: string;
		if (typeof data?.error === 'string') {
			errorMessage = data.error;
		} else if (data && typeof data === 'object') {
			const parts: string[] = [];
			if (data.error) parts.push(String(data.error));
			if (data.message) parts.push(String(data.message));
			if (data.details && typeof data.details === 'object')
				parts.push(`Details: ${JSON.stringify(data.details, null, 2)}`);
			errorMessage = parts.length
				? parts.join('\n')
				: JSON.stringify(data, null, 2);
		} else {
			errorMessage = String(raw);
		}
		if (flags.jsonStreamEnabled) {
			Bun.write(
				Bun.stdout,
				`${JSON.stringify({
					event: 'error',
					ts: Date.now(),
					error: errorMessage,
				})}\n`,
			);
		} else {
			Bun.write(Bun.stderr, `\n[error] ${errorMessage}\n`);
		}
	}
}

function parseFlags(argv: string[]) {
	return {
		verbose: argv.includes('--verbose'),
		readVerbose: argv.includes('--read-verbose'),
		summaryEnabled: argv.includes('--summary'),
		jsonEnabled: argv.includes('--json'),
		jsonVerbose: argv.includes('--json-verbose'),
		jsonStreamEnabled: argv.includes('--json-stream'),
	};
}

function announceContext(args: {
	opts: AskOptions;
	header: { agent?: string; provider?: string; model?: string };
	defaults: { agent: string; provider: ProviderId; model: string };
	jsonMode: boolean;
}) {
	if (args.jsonMode) return;
	const agent = args.opts.agent ?? args.header.agent ?? args.defaults.agent;
	const provider = (args.opts.provider ??
		args.header.provider ??
		args.defaults.provider) as ProviderId;
	const model = args.opts.model ?? args.header.model ?? args.defaults.model;
	Bun.write(
		Bun.stderr,
		`${bold('Context')} ${dim('•')} agent=${agent} ${dim('•')} provider=${provider} ${dim('•')} model=${model}\n`,
	);
}

function truncate(value: string, max: number) {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

function mergeTokenUsage(
	usage: Record<string, unknown> | undefined,
	costUsd: unknown,
	finish: unknown,
): TokenUsageSummary | null {
	const inputTokens = toNumberOrUndefined(usage?.inputTokens);
	const outputTokens = toNumberOrUndefined(usage?.outputTokens);
	const totalTokens = toNumberOrUndefined(usage?.totalTokens);
	const cost = toNumberOrUndefined(costUsd);
	const finishReason =
		typeof finish === 'string' && finish.trim().length
			? finish.trim()
			: undefined;
	if (
		inputTokens == null &&
		outputTokens == null &&
		totalTokens == null &&
		cost == null &&
		!finishReason
	)
		return null;
	return {
		inputTokens: inputTokens ?? undefined,
		outputTokens: outputTokens ?? undefined,
		totalTokens:
			totalTokens ??
			((inputTokens ?? null) != null && (outputTokens ?? null) != null
				? (inputTokens ?? 0) + (outputTokens ?? 0)
				: undefined),
		costUsd: cost ?? undefined,
		finishReason,
	};
}

function toNumberOrUndefined(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed.length) return undefined;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}
