import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { getAllAuth } from '@/auth/index.ts';
import type { ProviderId } from '@/auth/index.ts';
import { catalog } from '@/providers/catalog.ts';
import type { Artifact } from '@/ai/artifacts.ts';

type AskOptions = {
	agent?: string;
	provider?: ProviderId;
	model?: string;
	project?: string;
	sessionId?: string;
	last?: boolean;
};

type SessionMeta = {
	id: string | number;
	agent?: string;
	provider?: string;
	model?: string;
};

type AssistantChunk = { ts: number; delta: string };
type ToolCallRecord = {
	name: string;
	args?: unknown;
	callId?: string;
	ts: number;
};
type ToolResultRecord = {
	name: string;
	result?: unknown;
	artifact?: Artifact;
	callId?: string;
	ts: number;
	durationMs?: number;
};

type SequenceEntry =
	| { type: 'user'; ts: number; text: string }
	| {
			type: 'assistant';
			tsStart: number;
			tsEnd: number;
			index: number;
			text: string;
	  }
	| {
			type: 'tool.call';
			ts: number;
			name: string;
			callId?: string;
			args?: unknown;
	  }
	| {
			type: 'tool.result';
			ts: number;
			name: string;
			callId?: string;
			durationMs?: number;
			result?: unknown;
			artifact?: Artifact;
	  };

type Transcript = {
	sessionId: string | null;
	assistantMessageId: string;
	agent: string;
	provider: ProviderId;
	model: string;
	sequence: SequenceEntry[];
	filesTouched: string[];
	summary: {
		toolCounts: Record<string, number>;
		toolTimings: Array<{ name: string; durationMs?: number }>;
		totalToolTimeMs: number;
		filesTouched: string[];
		diffArtifacts: Array<{ name: string; summary: unknown }>;
	};
	output?: string;
	assistantChunks?: AssistantChunk[];
	assistantLines?: ReturnType<typeof computeAssistantLines>;
	assistantSegments?: ReturnType<typeof computeAssistantSegments>;
	tools?: { calls: ToolCallRecord[]; results: ToolResultRecord[] };
};

export async function runAsk(prompt: string, opts: AskOptions = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const baseUrl = process.env.AGI_SERVER_URL || (await startEphemeralServer());

	// Choose an authorized provider/model when not explicitly provided
	let chosenProvider: ProviderId = opts.provider ?? cfg.defaults.provider;
	let chosenModel: string = opts.model ?? cfg.defaults.model;
	try {
		const auth = await getAllAuth(projectRoot);
		const envHas = {
			openai: Boolean(process.env.OPENAI_API_KEY),
			anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
			google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
		} as const;
		const cfgHas = {
			openai: Boolean(cfg.providers.openai?.apiKey),
			anthropic: Boolean(cfg.providers.anthropic?.apiKey),
			google: Boolean(cfg.providers.google?.apiKey),
		} as const;
		function authed(p: ProviderId) {
			const info = auth[p];
			const hasStored = info?.type === 'api' && Boolean(info.key);
			return envHas[p] || hasStored || cfgHas[p];
		}
		if (!authed(chosenProvider)) {
			const order: ProviderId[] = ['anthropic', 'openai', 'google'];
			const alt = order.find((p) => authed(p));
			if (alt) chosenProvider = alt;
		}
		const models = catalog[chosenProvider]?.models ?? [];
		const ok = models.some((m) => m.id === chosenModel);
		if (!ok && models.length) chosenModel = models[0].id;
	} catch {}

	// Parse output flags early so we can use them while choosing/creating a session
	const verbose = process.argv.includes('--verbose');
	const summaryEnabled = process.argv.includes('--summary');
	const jsonEnabled = process.argv.includes('--json');
	const jsonVerbose = process.argv.includes('--json-verbose');
	const jsonStreamEnabled = process.argv.includes('--json-stream');

	// Resolve target session
	let sessionId: string | null = null;
	const startedAt = Date.now();
	let header: {
		agent?: string;
		provider?: string;
		model?: string;
		sessionId?: string;
	} = {};
	if (opts.sessionId) {
		sessionId = opts.sessionId;
		try {
			const sessions = await httpJson<SessionMeta[]>(
				'GET',
				`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
			);
			const found = sessions.find((s) => String(s.id) === String(sessionId));
			if (found)
				header = {
					agent: found.agent,
					provider: found.provider,
					model: found.model,
					sessionId,
				};
		} catch {}
	} else if (opts.last) {
		// Fetch sessions and pick the most recent
		const sessions = await httpJson<SessionMeta[]>(
			'GET',
			`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
		);
		if (!sessions.length) {
			const created = await httpJson<SessionMeta>(
				'POST',
				`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
				{
					title: null,
					agent: opts.agent ?? cfg.defaults.agent,
					provider: chosenProvider,
					model: chosenModel,
				},
			);
			sessionId = String(created.id);
			header = {
				agent: opts.agent ?? cfg.defaults.agent,
				provider: chosenProvider,
				model: chosenModel,
				sessionId,
			};
		} else {
			sessionId = String(sessions[0].id);
			header = {
				agent: sessions[0].agent,
				provider: sessions[0].provider,
				model: sessions[0].model,
				sessionId,
			};
			if (!jsonEnabled && !jsonStreamEnabled)
				Bun.write(
					Bun.stderr,
					`${dim('Using last session')} ${sessions[0].id}\n`,
				);
		}
	} else {
		const created = await httpJson<SessionMeta>(
			'POST',
			`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
			{
				title: null,
				agent: opts.agent ?? cfg.defaults.agent,
				provider: chosenProvider,
				model: chosenModel,
			},
		);
		sessionId = String(created.id);
		header = {
			agent: opts.agent ?? cfg.defaults.agent,
			provider: chosenProvider,
			model: chosenModel,
			sessionId,
		};
		if (!jsonEnabled && !jsonStreamEnabled)
			Bun.write(Bun.stderr, `${dim('Created new session')} ${sessionId}\n`);
	}

	// Start SSE reader before enqueuing the message to avoid missing early events
	const sse = await connectSSE(
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/stream?project=${encodeURIComponent(projectRoot)}`,
	);

	// Header: show agent/provider/model
	if (!jsonEnabled && !jsonStreamEnabled) {
		const p = header.provider ?? chosenProvider;
		const m = header.model ?? chosenModel;
		const a = header.agent ?? opts.agent ?? cfg.defaults.agent;
		Bun.write(
			Bun.stderr,
			`${bold('Context')} ${dim('•')} agent=${a} ${dim('•')} provider=${p} ${dim('•')} model=${m}\n`,
		);
	}

	const enqueueRes = await httpJson<{ messageId: string }>(
		'POST',
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/messages?project=${encodeURIComponent(projectRoot)}`,
		{
			content: prompt,
			// For existing sessions, avoid overriding defaults unless explicitly provided
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
		},
	);
	const assistantMessageId = enqueueRes.messageId as string;

	// flags already parsed above

	let finalizeSeen = false;
	let output = '';
	const assistantChunks: AssistantChunk[] = [];
	const toolCalls: ToolCallRecord[] = [];
	const toolResults: ToolResultRecord[] = [];
	const callById = new Map<string, number>();
	const filesTouched = new Set<string>();
	try {
		for await (const ev of sse) {
			const eventName = ev.event;
			if (eventName === 'message.part.delta') {
				const data = safeJson(ev.data);
				const messageId =
					typeof data?.messageId === 'string' ? data.messageId : undefined;
				const delta = typeof data?.delta === 'string' ? data.delta : undefined;
				if (messageId === assistantMessageId && delta) {
					output += delta;
					const ts = Date.now();
					assistantChunks.push({ ts, delta });
					if (jsonStreamEnabled) {
						Bun.write(
							Bun.stdout,
							`${JSON.stringify({
								event: 'assistant.delta',
								ts,
								messageId: assistantMessageId,
								delta,
							})}\n`,
						);
					} else if (!jsonEnabled) {
						Bun.write(Bun.stdout, delta);
					}
				}
			} else if (eventName === 'tool.call') {
				const data = safeJson(ev.data);
				const name = typeof data?.name === 'string' ? data.name : 'tool';
				const callId =
					typeof data?.callId === 'string' ? data.callId : undefined;
				const ts = Date.now();
				toolCalls.push({ name, args: data?.args, callId, ts });
				if (callId) callById.set(callId, toolCalls.length - 1);
				if (jsonStreamEnabled) {
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
				} else if (!jsonEnabled) {
					printToolCall(name, data?.args, { verbose });
				}
			} else if (eventName === 'tool.delta') {
				const data = safeJson(ev.data);
				const name = typeof data?.name === 'string' ? data.name : 'tool';
				const channel =
					typeof data?.channel === 'string' ? data.channel : 'output';
				if (jsonStreamEnabled) {
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
				} else if ((channel === 'input' && !verbose) || jsonEnabled) {
					// Avoid noisy input-argument streaming by default
				} else {
					const deltaValue =
						typeof data?.delta === 'string'
							? data.delta
							: JSON.stringify(data?.delta);
					if (deltaValue)
						Bun.write(
							Bun.stderr,
							`${dim(`[${channel}]`)} ${cyan(name)} ${dim('›')} ${truncate(deltaValue, 160)}\n`,
						);
				}
			} else if (eventName === 'tool.result') {
				const data = safeJson(ev.data);
				const name = typeof data?.name === 'string' ? data.name : 'tool';
				const callId =
					typeof data?.callId === 'string' ? data.callId : undefined;
				const ts = Date.now();
				let durationMs: number | undefined;
				if (callId) {
					const idx = callById.get(callId);
					if (idx !== undefined) {
						const started = toolCalls[idx]?.ts;
						if (typeof started === 'number') {
							durationMs = Math.max(0, ts - started);
						}
					}
				}
				const artifact = data?.artifact as Artifact | undefined;
				toolResults.push({
					name,
					result: data?.result,
					artifact,
					callId,
					ts,
					durationMs,
				});
				if (
					artifact?.kind === 'file_diff' &&
					typeof artifact.patch === 'string'
				) {
					for (const f of extractFilesFromPatch(String(artifact.patch)))
						filesTouched.add(f);
				}
				const resultValue = data?.result as { path?: unknown } | undefined;
				if (name === 'fs_write' && typeof resultValue?.path === 'string')
					filesTouched.add(String(resultValue.path));
				if (jsonStreamEnabled) {
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
				} else if (!jsonEnabled) {
					printToolResult(name, data?.result, artifact, {
						verbose,
						durationMs,
					});
				}
				if (name === 'finalize') finalizeSeen = true;
			} else if (eventName === 'message.completed') {
				const data = safeJson(ev.data);
				const completedId = typeof data?.id === 'string' ? data.id : undefined;
				if (completedId === assistantMessageId) {
					if (jsonStreamEnabled)
						Bun.write(
							Bun.stdout,
							`${JSON.stringify({
								event: 'assistant.completed',
								ts: Date.now(),
								messageId: assistantMessageId,
							})}\n`,
						);
					break;
				}
			} else if (eventName === 'error') {
				const data = safeJson(ev.data);
				const msg = typeof data?.error === 'string' ? data.error : ev.data;
				if (jsonStreamEnabled)
					Bun.write(
						Bun.stdout,
						`${JSON.stringify({
							event: 'error',
							ts: Date.now(),
							error: String(msg),
						})}\n`,
					);
				else Bun.write(Bun.stderr, `\n[error] ${String(msg)}\n`);
			}
		}
	} finally {
		await sse.close();
	}

	// Final newline if we streamed content
	if (output.length && !jsonEnabled && !jsonStreamEnabled)
		Bun.write(Bun.stdout, '\n');

	if (jsonStreamEnabled) {
		if (!process.env.AGI_SERVER_URL && currentServer) {
			try {
				currentServer.stop();
			} catch {}
			currentServer = null;
		}
		return;
	} else if (jsonEnabled) {
		const toolCounts: Record<string, number> = {};
		for (const c of toolCalls)
			toolCounts[c.name] = (toolCounts[c.name] ?? 0) + 1;
		const diffArtifacts = toolResults
			.filter((r) => r.artifact?.kind === 'file_diff')
			.map((r) => ({ name: r.name, summary: r.artifact?.summary }));
		const toolTimings = toolResults
			.filter((r) => typeof r.durationMs === 'number')
			.map((r) => ({ name: r.name, durationMs: r.durationMs }));
		const totalToolTimeMs = toolTimings.reduce(
			(a, b) => a + (b.durationMs ?? 0),
			0,
		);
		const assistantText = output;
		const assistantLines = computeAssistantLines(assistantChunks);
		const assistantSegments = computeAssistantSegments(
			assistantChunks,
			toolCalls,
		);
		const _assistantHeadline =
			(assistantSegments.length
				? assistantSegments[0].text
				: assistantLines.length
					? assistantLines[0].text
					: assistantText
			)?.slice(0, 160) ?? '';

		// Compact transcript by default; include verbose fields only when requested
		const transcript: Transcript = {
			sessionId,
			assistantMessageId,
			agent: opts.agent ?? cfg.defaults.agent,
			provider: opts.provider ?? chosenProvider,
			model: opts.model ?? chosenModel,
			sequence: buildSequence({
				prompt,
				assistantSegments,
				toolCalls,
				toolResults,
			}),
			filesTouched: Array.from(filesTouched),
			summary: {
				toolCounts,
				toolTimings,
				totalToolTimeMs,
				filesTouched: Array.from(filesTouched),
				diffArtifacts,
			},
		};
		if (jsonVerbose) {
			transcript.output = assistantText;
			transcript.assistantChunks = assistantChunks;
			transcript.assistantLines = assistantLines;
			transcript.assistantSegments = assistantSegments;
			transcript.tools = { calls: toolCalls, results: toolResults };
		}
		Bun.write(Bun.stdout, `${JSON.stringify(transcript, null, 2)}\n`);
	} else if (summaryEnabled || finalizeSeen) {
		printSummary(toolCalls, toolResults, filesTouched);
	}
	if (!jsonEnabled && !jsonStreamEnabled) {
		const elapsed = Date.now() - startedAt;
		Bun.write(Bun.stderr, `${dim(`Done in ${elapsed}ms`)}\n`);
	}

	// If we started an ephemeral server, stop it
	if (!process.env.AGI_SERVER_URL && currentServer) {
		try {
			currentServer.stop();
		} catch {}
		currentServer = null;
	}
}

// Ephemeral server support
let currentServer: ReturnType<typeof Bun.serve> | null = null;
async function startEphemeralServer(): Promise<string> {
	if (currentServer) return `http://localhost:${currentServer.port}`;
	const app = createApp();
	currentServer = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 240 });
	return `http://localhost:${currentServer.port}`;
}

export async function getOrStartServerUrl(): Promise<string> {
	if (process.env.AGI_SERVER_URL) return String(process.env.AGI_SERVER_URL);
	return await startEphemeralServer();
}

export async function stopEphemeralServer(): Promise<void> {
	if (currentServer) {
		try {
			currentServer.stop();
		} catch {}
		currentServer = null;
	}
}

// Capture-only variant used by command dispatcher: returns the assistant text without printing
export async function runAskCapture(prompt: string, opts: AskOptions = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const baseUrl = await getOrStartServerUrl();

	// Choose provider/model similar to runAsk
	let chosenProvider: ProviderId = opts.provider ?? cfg.defaults.provider;
	let chosenModel: string = opts.model ?? cfg.defaults.model;
	try {
		const auth = await (await import('@/auth/index.ts')).getAllAuth(
			projectRoot,
		);
		const envHas = {
			openai: Boolean(process.env.OPENAI_API_KEY),
			anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
			google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
		} as const;
		const cfgHas = {
			openai: Boolean(cfg.providers.openai?.apiKey),
			anthropic: Boolean(cfg.providers.anthropic?.apiKey),
			google: Boolean(cfg.providers.google?.apiKey),
		} as const;
		function authed(p: ProviderId) {
			const info = auth[p];
			const hasStored = info?.type === 'api' && Boolean(info.key);
			return envHas[p] || hasStored || cfgHas[p];
		}
		if (!authed(chosenProvider)) {
			const order: ProviderId[] = ['anthropic', 'openai', 'google'];
			const alt = order.find((p) => authed(p));
			if (alt) chosenProvider = alt;
		}
		const models =
			(await import('@/providers/catalog.ts')).catalog[chosenProvider]
				?.models ?? [];
		const ok = models.some((m) => m.id === chosenModel);
		if (!ok && models.length) chosenModel = models[0].id;
	} catch {}

	// Create a session
	const created = await httpJson<SessionMeta>(
		'POST',
		`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
		{
			title: null,
			agent: opts.agent ?? cfg.defaults.agent,
			provider: chosenProvider,
			model: chosenModel,
		},
	);
	const sessionId = String(created.id);

	// Subscribe SSE then enqueue message
	const sse = await connectSSE(
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/stream?project=${encodeURIComponent(projectRoot)}`,
	);
	const enqueueRes = await httpJson<{ messageId: string }>(
		'POST',
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/messages?project=${encodeURIComponent(projectRoot)}`,
		{
			content: prompt,
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
		},
	);
	const assistantMessageId = enqueueRes.messageId as string;

	let output = '';
	try {
		for await (const ev of sse) {
			if (ev.event === 'message.part.delta') {
				const data = safeJson(ev.data);
				if (
					data?.messageId === assistantMessageId &&
					typeof data?.delta === 'string'
				) {
					output += data.delta;
				}
			} else if (ev.event === 'message.completed') {
				const data = safeJson(ev.data);
				if (data?.id === assistantMessageId) break;
			}
		}
	} finally {
		await sse.close();
	}
	return { sessionId, text: output };
}

// Streaming + capture: prints assistant deltas like one-shot, and returns the full assistant text
export async function runAskStreamCapture(
	prompt: string,
	opts: AskOptions = {},
) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const baseUrl = await getOrStartServerUrl();

	// Choose provider/model similar to runAsk
	let chosenProvider: ProviderId = opts.provider ?? cfg.defaults.provider;
	let chosenModel: string = opts.model ?? cfg.defaults.model;
	try {
		const auth = await (await import('@/auth/index.ts')).getAllAuth(
			projectRoot,
		);
		const envHas = {
			openai: Boolean(process.env.OPENAI_API_KEY),
			anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
			google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
		} as const;
		const cfgHas = {
			openai: Boolean(cfg.providers.openai?.apiKey),
			anthropic: Boolean(cfg.providers.anthropic?.apiKey),
			google: Boolean(cfg.providers.google?.apiKey),
		} as const;
		function authed(p: ProviderId) {
			const info = auth[p];
			const hasStored = info?.type === 'api' && Boolean(info.key);
			return envHas[p] || hasStored || cfgHas[p];
		}
		if (!authed(chosenProvider)) {
			const order: ProviderId[] = ['anthropic', 'openai', 'google'];
			const alt = order.find((p) => authed(p));
			if (alt) chosenProvider = alt;
		}
		const models =
			(await import('@/providers/catalog.ts')).catalog[chosenProvider]
				?.models ?? [];
		const ok = models.some((m) => m.id === chosenModel);
		if (!ok && models.length) chosenModel = models[0].id;
	} catch {}

	// Create a session
	const created = await httpJson<SessionMeta>(
		'POST',
		`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
		{
			title: null,
			agent: opts.agent ?? cfg.defaults.agent,
			provider: chosenProvider,
			model: chosenModel,
		},
	);
	const sessionId = String(created.id);

	// Subscribe SSE then enqueue message
	const sse = await connectSSE(
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/stream?project=${encodeURIComponent(projectRoot)}`,
	);
	const enqueueRes = await httpJson<{ messageId: string }>(
		'POST',
		`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/messages?project=${encodeURIComponent(projectRoot)}`,
		{
			content: prompt,
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
		},
	);
	const assistantMessageId = enqueueRes.messageId as string;

	let output = '';
	const verbose = process.argv.includes('--verbose');
	const callStarts = new Map<string, number>();
	try {
		for await (const ev of sse) {
			if (ev.event === 'message.part.delta') {
				const data = safeJson(ev.data);
				if (
					data?.messageId === assistantMessageId &&
					typeof data?.delta === 'string'
				) {
					output += data.delta;
					Bun.write(Bun.stdout, data.delta);
				}
			} else if (ev.event === 'tool.call') {
				const data = safeJson(ev.data);
				const name = data?.name ?? 'tool';
				const callId = data?.callId as string | undefined;
				const ts = Date.now();
				if (callId) callStarts.set(callId, ts);
				printToolCall(name, data?.args, { verbose });
			} else if (ev.event === 'tool.delta') {
				const data = safeJson(ev.data);
				const name = data?.name ?? 'tool';
				const channel = data?.channel ?? 'output';
				if (channel === 'input' && !verbose) {
					// suppress noisy input streaming unless verbose
				} else {
					const delta =
						typeof data?.delta === 'string'
							? data.delta
							: JSON.stringify(data?.delta);
					if (delta)
						Bun.write(
							Bun.stderr,
							`${dim(`[${channel}]`)} ${cyan(name)} ${dim('›')} ${truncate(delta, 160)}\n`,
						);
				}
			} else if (ev.event === 'tool.result') {
				const data = safeJson(ev.data);
				const name = data?.name ?? 'tool';
				const callId = data?.callId as string | undefined;
				let durationMs: number | undefined;
				if (callId && callStarts.has(callId)) {
					durationMs = Math.max(
						0,
						Date.now() - (callStarts.get(callId) || Date.now()),
					);
				}
				printToolResult(name, data?.result, data?.artifact, {
					verbose,
					durationMs,
				});
			} else if (ev.event === 'message.completed') {
				const data = safeJson(ev.data);
				if (data?.id === assistantMessageId) break;
			}
		}
	} finally {
		await sse.close();
	}
	if (output.length) Bun.write(Bun.stdout, '\n');
	return { sessionId, text: output };
}

// Minimal JSON request helper
async function httpJson<T>(
	method: string,
	url: string,
	body?: unknown,
): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
	}
	return (await res.json()) as T;
}

// Simple SSE client using fetch + ReadableStream parsing
type SSEEvent = { event: string; data: string };

async function* sseIterator(resp: Response): AsyncGenerator<SSEEvent> {
	if (!resp.body) return;
	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx = buffer.indexOf('\n\n');
		while (idx !== -1) {
			const raw = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 2);
			const lines = raw.split('\n');
			let event = 'message';
			let data = '';
			for (const line of lines) {
				if (line.startsWith('event: ')) event = line.slice(7).trim();
				else if (line.startsWith('data: '))
					data += (data ? '\n' : '') + line.slice(6);
			}
			if (data) yield { event, data };
			idx = buffer.indexOf('\n\n');
		}
	}
}

async function connectSSE(url: string) {
	const controller = new AbortController();
	const res = await fetch(url, {
		headers: { Accept: 'text/event-stream' },
		signal: controller.signal,
	});
	const iterator = sseIterator(res);
	return {
		async *[Symbol.asyncIterator]() {
			for await (const ev of iterator) yield ev;
		},
		async close() {
			// Abort the fetch to close the SSE stream without ReadableStream state errors
			try {
				controller.abort();
			} catch {}
		},
	};
}

function safeJson(input: string): Record<string, unknown> | undefined {
	try {
		const parsed = JSON.parse(input);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {}
	return undefined;
}

function truncate(s: string, n: number) {
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}

function computeAssistantLines(
	chunks: Array<{ ts: number; delta: string }>,
): Array<{ index: number; tsStart: number; tsEnd: number; text: string }> {
	const lines: Array<{
		index: number;
		tsStart: number;
		tsEnd: number;
		text: string;
	}> = [];
	let buffer = '';
	let startTs = chunks.length ? chunks[0].ts : Date.now();
	let index = 0;
	for (const { ts, delta } of chunks) {
		let remaining = delta;
		while (remaining.includes('\n')) {
			const i = remaining.indexOf('\n');
			const part = remaining.slice(0, i);
			buffer += part;
			const text = buffer.trim();
			if (text.length)
				lines.push({ index: index++, tsStart: startTs, tsEnd: ts, text });
			buffer = '';
			startTs = ts;
			remaining = remaining.slice(i + 1);
		}
		buffer += remaining;
	}
	if (buffer.trim().length) {
		lines.push({
			index: index++,
			tsStart: startTs,
			tsEnd: chunks.length ? chunks[chunks.length - 1].ts : startTs,
			text: buffer.trim(),
		});
	}
	return lines;
}

function computeAssistantSegments(
	chunks: Array<{ ts: number; delta: string }>,
	calls: Array<{ ts: number }>,
): Array<{ index: number; tsStart: number; tsEnd: number; text: string }> {
	const segments: Array<{
		index: number;
		tsStart: number;
		tsEnd: number;
		text: string;
	}> = [];
	if (!chunks.length) return segments;
	const callTimes = calls.map((c) => c.ts).sort((a, b) => a - b);
	let buffer = '';
	let startTs = chunks[0].ts;
	let segIndex = 0;
	let callIdx = 0;

	for (const { ts, delta } of chunks) {
		// If this delta occurs at or after the next tool.call, flush current buffer as a segment
		while (callIdx < callTimes.length && ts >= callTimes[callIdx]) {
			if (buffer.trim().length) {
				segments.push({
					index: segIndex++,
					tsStart: startTs,
					tsEnd: ts,
					text: buffer.trim(),
				});
				buffer = '';
			}
			// Start a new segment after the call time
			startTs = ts;
			callIdx++;
		}
		buffer += delta;
	}
	if (buffer.trim().length) {
		segments.push({
			index: segIndex++,
			tsStart: startTs,
			tsEnd: chunks[chunks.length - 1].ts,
			text: buffer.trim(),
		});
	}
	return segments;
}

function buildSequence(args: {
	prompt: string;
	assistantSegments: ReturnType<typeof computeAssistantSegments>;
	toolCalls: ToolCallRecord[];
	toolResults: ToolResultRecord[];
}): SequenceEntry[] {
	const seq: SequenceEntry[] = [];
	// Seed with user prompt
	seq.push({
		type: 'user',
		ts: args.assistantSegments[0]?.tsStart ?? Date.now(),
		text: args.prompt,
	});

	// Convert assistant lines to events
	for (const l of args.assistantSegments) {
		seq.push({
			type: 'assistant',
			tsStart: l.tsStart,
			tsEnd: l.tsEnd,
			index: l.index,
			text: l.text,
		});
	}
	// Tool events
	for (const c of args.toolCalls)
		seq.push({
			type: 'tool.call',
			ts: c.ts,
			name: c.name,
			callId: c.callId,
			args: c.args,
		});
	for (const r of args.toolResults)
		seq.push({
			type: 'tool.result',
			ts: r.ts,
			name: r.name,
			callId: r.callId,
			durationMs: r.durationMs,
			result: r.result,
			artifact: r.artifact,
		});

	// Sort by timestamp; assistant events may have tsStart, use that; keep stable within same ts
	seq.sort((a, b) => {
		const ta = 'tsStart' in a ? a.tsStart : (a.ts ?? 0);
		const tb = 'tsStart' in b ? b.tsStart : (b.ts ?? 0);
		return ta - tb;
	});
	return seq;
}

function extractFilesFromPatch(patch: string): string[] {
	const lines = patch.split('\n');
	const files: string[] = [];
	const re = /^\*\*\*\s+(Add|Update|Delete) File:\s+(.+)$/;
	for (const line of lines) {
		const m = line.match(re);
		if (m) files.push(m[2]);
	}
	return files;
}

function printSummary(
	toolCalls: ToolCallRecord[],
	toolResults: ToolResultRecord[],
	filesTouched: Set<string>,
) {
	Bun.write(Bun.stderr, `\n${bold('Summary')}\n`);
	if (toolCalls.length) {
		Bun.write(Bun.stderr, `${bold('Tools used:')}\n`);
		const counts = new Map<string, number>();
		for (const c of toolCalls)
			counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
		for (const [name, count] of counts) {
			const suffix = count > 1 ? ` × ${count}` : '';
			Bun.write(Bun.stderr, `  ${green('•')} ${name}${suffix}\n`);
		}
	}
	if (filesTouched.size) {
		Bun.write(Bun.stderr, `${bold('Files touched:')}\n`);
		for (const f of filesTouched)
			Bun.write(Bun.stderr, `  ${green('•')} ${f}\n`);
	}
	const diffs = toolResults.filter((r) => r.artifact?.kind === 'file_diff');
	if (diffs.length) {
		Bun.write(Bun.stderr, `${bold('Diff artifacts:')}\n`);
		for (const d of diffs) {
			const s = d.artifact?.summary;
			const sum = s
				? ` (files:${s.files ?? '?'}, +${s.additions ?? '?'}, -${s.deletions ?? '?'})`
				: '';
			Bun.write(Bun.stderr, `  ${yellow('•')} ${d.name}${sum}\n`);
		}
	}
}

// Pretty printing helpers
const _reset = (s: string) => `\x1b[0m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

function printToolCall(
	name: string,
	args?: unknown,
	opts?: { verbose?: boolean },
) {
	const v = opts?.verbose;
	const title = `${bold('›')} ${cyan(name)} ${dim('running...')}`;
	if (!args || !v) {
		Bun.write(Bun.stderr, `\n${title}\n`);
		return;
	}
	const preview = truncate(JSON.stringify(args), 200);
	Bun.write(Bun.stderr, `\n${title}\n${dim(preview)}\n`);
}

function printToolResult(
	name: string,
	result?: unknown,
	artifact?: Artifact,
	opts?: { verbose?: boolean; durationMs?: number },
) {
	const time =
		typeof opts?.durationMs === 'number' ? dim(` (${opts.durationMs}ms)`) : '';
	// Special-case pretty formatting for common tools
	if (name === 'fs_tree' && result?.tree) {
		Bun.write(
			Bun.stderr,
			`${bold('↳ tree')} ${dim(result.path ?? '.')}${time}\n`,
		);
		Bun.write(Bun.stderr, `${result.tree}\n`);
		return;
	}
	if (name === 'fs_ls' && Array.isArray(result?.entries)) {
		const entries = result.entries as Array<{ name: string; type: string }>;
		Bun.write(
			Bun.stderr,
			`${bold('↳ ls')} ${dim(result.path ?? '.')}${time}\n`,
		);
		for (const e of entries.slice(0, 100)) {
			Bun.write(Bun.stderr, `  ${e.type === 'dir' ? '📁' : '📄'} ${e.name}\n`);
		}
		if (entries.length > 100)
			Bun.write(Bun.stderr, `${dim(`… and ${entries.length - 100} more`)}\n`);
		return;
	}
	if (name === 'fs_read' && typeof result?.path === 'string') {
		const content = String(result?.content ?? '');
		const lines = content.split('\n');
		Bun.write(
			Bun.stderr,
			`${bold('↳ read')} ${dim(result.path)} (${lines.length} lines)${time}\n`,
		);
		const sample = lines.slice(0, 20).join('\n');
		const suffix = lines.length > 20 ? `\n${dim('…')}` : '';
		Bun.write(Bun.stderr, `${sample}${suffix}\n`);
		return;
	}
	if (name === 'fs_write' && typeof result?.path === 'string') {
		Bun.write(
			Bun.stderr,
			`${bold('↳ wrote')} ${result.path} (${result?.bytes ?? '?'} bytes)${time}\n`,
		);
		return;
	}
	if (artifact?.kind === 'file_diff' && typeof artifact?.patch === 'string') {
		Bun.write(
			Bun.stderr,
			`${bold('↳ diff')} ${dim('(unified patch)')}${time}\n`,
		);
		const rawLines = artifact.patch.split('\n');
		const shown = rawLines.slice(0, 120);
		for (const line of shown) {
			if (line.startsWith('+')) Bun.write(Bun.stderr, `${green(line)}\n`);
			else if (line.startsWith('-')) Bun.write(Bun.stderr, `${red(line)}\n`);
			else if (line.startsWith('***')) Bun.write(Bun.stderr, `${dim(line)}\n`);
			else Bun.write(Bun.stderr, `${line}\n`);
		}
		if (rawLines.length > shown.length) Bun.write(Bun.stderr, `${dim('…')}\n`);
		return;
	}
	if (name === 'finalize') {
		Bun.write(Bun.stderr, `${bold('✓ done')}${time}\n`);
		return;
	}
	// Generic fallback
	const preview =
		result !== undefined ? truncate(JSON.stringify(result), 200) : '';
	const suffix = artifact?.kind ? ` ${dim(`artifact=${artifact.kind}`)}` : '';
	Bun.write(Bun.stderr, `${bold('↳')} ${cyan(name)}${suffix} ${preview}\n`);
}
