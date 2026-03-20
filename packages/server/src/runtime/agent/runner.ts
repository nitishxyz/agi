import { hasToolCall, streamText } from 'ai';
import { messageParts } from '@ottocode/database/schema';
import { eq } from 'drizzle-orm';
import { publish, subscribe } from '../../events/bus.ts';
import { time } from '../debug/index.ts';
import { toErrorPayload } from '../errors/handling.ts';
import {
	type RunOpts,
	setRunning,
	dequeueJob,
	cleanupSession,
} from '../session/queue.ts';
import {
	updateSessionTokensIncremental,
	updateMessageTokensIncremental,
	completeAssistantMessage,
	cleanupEmptyTextParts,
} from '../session/db-operations.ts';
import {
	createStepFinishHandler,
	createErrorHandler,
	createAbortHandler,
	createFinishHandler,
} from '../stream/handlers.ts';
import { pruneSession } from '../message/compaction.ts';
import { triggerDeferredTitleGeneration } from '../message/service.ts';
import { setupRunner } from './runner-setup.ts';
import {
	createMCPPrepareStepState,
	buildPrepareStep,
} from './mcp-prepare-step.ts';
import { adaptTools as adaptToolsFn } from '../../tools/adapter.ts';
import {
	type ReasoningState,
	handleReasoningStart,
	handleReasoningDelta,
	handleReasoningEnd,
} from './runner-reasoning.ts';
import {
	createOauthCodexTextGuardState,
	consumeOauthCodexTextDelta,
} from '../stream/text-guard.ts';
import { createTurnDumpCollector } from '../debug/turn-dump.ts';

export {
	enqueueAssistantRun,
	abortSession,
	abortMessage,
	removeFromQueue,
	getQueueState,
	getRunnerState,
} from '../session/queue.ts';

const DEFAULT_TRACED_TOOL_INPUTS = new Set([
	'write',
	'edit',
	'multiedit',
	'apply_patch',
]);

function shouldTraceToolInput(name: string): boolean {
	void DEFAULT_TRACED_TOOL_INPUTS;
	void name;
	return false;
}

function summarizeTraceValue(value: unknown, max = 160): string {
	try {
		const json = JSON.stringify(value);
		if (typeof json === 'string') {
			return json.length > max ? `${json.slice(0, max)}…` : json;
		}
	} catch {}
	const fallback = String(value);
	return fallback.length > max ? `${fallback.slice(0, max)}…` : fallback;
}

export async function runSessionLoop(sessionId: string) {
	setRunning(sessionId, true);

	while (true) {
		const job = await dequeueJob(sessionId);
		if (!job) break;

		try {
			await runAssistant(job);
		} catch {}
	}

	setRunning(sessionId, false);
	cleanupSession(sessionId);
}

async function runAssistant(opts: RunOpts) {
	const setup = await setupRunner(opts);
	const {
		cfg,
		db,
		history,
		system,
		additionalSystemMessages,
		model,
		effectiveMaxOutputTokens,
		sharedCtx,
		firstToolTimer,
		firstToolSeen,
		providerOptions,
		isOpenAIOAuth,
		mcpToolsRecord,
	} = setup;
	let { toolset } = setup;

	const hasMCPTools = Object.keys(mcpToolsRecord).length > 0;
	let prepareStep: ReturnType<typeof buildPrepareStep> | undefined;

	if (hasMCPTools) {
		const baseToolNames = Object.keys(toolset);
		const { getAuth: getAuthFn } = await import('@ottocode/sdk');
		const providerAuth = await getAuthFn(opts.provider, cfg.projectRoot);
		const adaptedMCP = adaptToolsFn(
			Object.entries(mcpToolsRecord).map(([name, tool]) => ({ name, tool })),
			sharedCtx,
			opts.provider,
			providerAuth?.type,
		);
		toolset = { ...toolset, ...adaptedMCP };
		const canonicalToRegistration: Record<string, string> = {};
		for (const canonical of Object.keys(mcpToolsRecord)) {
			const regKeys = Object.keys(adaptedMCP);
			const regName = regKeys.find(
				(k) =>
					k === canonical ||
					k.toLowerCase().replace(/_/g, '') ===
						canonical.toLowerCase().replace(/_/g, ''),
			);
			canonicalToRegistration[canonical] = regName ?? canonical;
		}
		const loadToolRegName =
			Object.keys(toolset).find(
				(k) =>
					k === 'load_mcp_tools' ||
					k.toLowerCase().replace(/_/g, '') === 'loadmcptools',
			) ?? 'load_mcp_tools';
		const mcpState = createMCPPrepareStepState(
			mcpToolsRecord,
			baseToolNames,
			canonicalToRegistration,
			loadToolRegName,
		);
		prepareStep = buildPrepareStep(mcpState);
	}

	const isFirstMessage = !history.some((m) => m.role === 'assistant');

	const messagesWithSystemInstructions: Array<{
		role: string;
		content: string | Array<unknown>;
	}> = [...additionalSystemMessages, ...history];

	if (!isFirstMessage) {
		if (isOpenAIOAuth) {
			messagesWithSystemInstructions.push({
				role: 'system',
				content:
					'SYSTEM REMINDER: You are continuing an existing session. Continue executing directly, use tools as needed, and provide a concise final summary when complete.',
			});
		} else {
			messagesWithSystemInstructions.push({
				role: 'user',
				content:
					'SYSTEM REMINDER: You are continuing an existing session. When you have completed the task, you MUST stream a text summary of what you did to the user, and THEN call the `finish` tool. Do not call `finish` without a summary.',
			});
		}
	}
	if ((opts.continuationCount ?? 0) > 0) {
		if (isOpenAIOAuth) {
			messagesWithSystemInstructions.push({
				role: 'system',
				content:
					'SYSTEM REMINDER: Your previous response stopped mid-task. Continue immediately from where you left off and finish the actual implementation, not just a plan update.',
			});
		} else {
			messagesWithSystemInstructions.push({
				role: 'user',
				content:
					'SYSTEM REMINDER: Your previous response stopped before calling `finish`. Continue executing immediately from where you left off, avoid plan-only updates, and call `finish` only after streaming the final user summary.',
			});
		}
	}

	const dump = createTurnDumpCollector({
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		provider: opts.provider,
		model: opts.model,
		agent: opts.agent,
		continuationCount: opts.continuationCount,
	});
	if (dump) {
		dump.setSystemPrompt(system, setup.systemComponents);
		dump.setAdditionalSystemMessages(
			additionalSystemMessages as Array<{ role: string; content: string }>,
		);
		dump.setHistory(history as Array<{ role: string; content: unknown }>);
		dump.setFinalMessages(messagesWithSystemInstructions);
		dump.setTools(toolset);
		dump.setModelConfig({
			maxOutputTokens: setup.maxOutputTokens,
			effectiveMaxOutputTokens,
			providerOptions,
			isOpenAIOAuth,
			needsSpoof: setup.needsSpoof,
		});
	}

	let _finishObserved = false;
	let _toolActivityObserved = false;
	let _trailingAssistantTextAfterTool = false;
	let _endedWithToolActivity = false;
	let _lastToolName: string | undefined;
	let _abortedByUser = false;
	let titleGenerationTriggered = false;
	const unsubscribeFinish = subscribe(opts.sessionId, (evt) => {
		if (evt.type === 'tool.call' || evt.type === 'tool.result') {
			_toolActivityObserved = true;
			_trailingAssistantTextAfterTool = false;
			_endedWithToolActivity = true;
			try {
				_lastToolName = (evt.payload as { name?: string } | undefined)?.name;
			} catch {
				_lastToolName = undefined;
			}
		}
		if (evt.type === 'tool.call') {
			triggerTitleGenerationWhenReady();
			if (dump) {
				try {
					const p = evt.payload as {
						name?: string;
						callId?: string;
						args?: unknown;
					};
					dump.recordToolCall(stepIndex, p.name ?? '', p.callId ?? '', p.args);
				} catch {}
			}
		}
		if (evt.type === 'tool.result') {
			if (dump) {
				try {
					const p = evt.payload as {
						name?: string;
						callId?: string;
						result?: unknown;
					};
					dump.recordToolResult(
						stepIndex,
						p.name ?? '',
						p.callId ?? '',
						p.result,
					);
				} catch {}
			}
			try {
				const name = (evt.payload as { name?: string } | undefined)?.name;
				if (name === 'finish') _finishObserved = true;
			} catch {}
		}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;

	let currentPartId: string | null = null;
	let accumulated = '';
	let latestAssistantText = '';
	let lastTextDeltaStepIndex: number | null = null;
	let stepIndex = 0;
	const oauthTextGuard = isOpenAIOAuth
		? createOauthCodexTextGuardState()
		: null;

	const getCurrentPartId = () => currentPartId;
	const getStepIndex = () => stepIndex;
	const updateCurrentPartId = (id: string | null) => {
		currentPartId = id;
	};
	const updateAccumulated = (text: string) => {
		accumulated = text;
	};
	const incrementStepIndex = () => {
		stepIndex += 1;
		return stepIndex;
	};
	const triggerTitleGenerationWhenReady = () => {
		if (titleGenerationTriggered) {
			return;
		}

		titleGenerationTriggered = true;
		if (!isFirstMessage) {
			return;
		}

		void triggerDeferredTitleGeneration({
			cfg,
			db,
			sessionId: opts.sessionId,
		});
	};

	const reasoningStates = new Map<string, ReasoningState>();

	const onStepFinish = createStepFinishHandler(
		opts,
		db,
		getStepIndex,
		incrementStepIndex,
		getCurrentPartId,
		updateCurrentPartId,
		updateAccumulated,
		triggerTitleGenerationWhenReady,
		sharedCtx,
		updateSessionTokensIncremental,
		updateMessageTokensIncremental,
	);

	const onError = createErrorHandler(
		opts,
		db,
		getStepIndex,
		sharedCtx,
		runSessionLoop,
	);

	const baseOnAbort = createAbortHandler(opts, db, getStepIndex, sharedCtx);
	const onAbort = async (event: Parameters<typeof baseOnAbort>[0]) => {
		_abortedByUser = true;
		await baseOnAbort(event);
	};

	const onFinish = createFinishHandler(opts, db, completeAssistantMessage);
	const isCopilotResponsesApi =
		opts.provider === 'copilot' && !opts.model.startsWith('gpt-5-mini');
	const stopWhenCondition = isCopilotResponsesApi
		? undefined
		: hasToolCall('finish');

	try {
		const result = streamText({
			model,
			tools: toolset,
			...(system ? { system } : {}),
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK message types are complex
			messages: messagesWithSystemInstructions as any,
			...(effectiveMaxOutputTokens
				? { maxOutputTokens: effectiveMaxOutputTokens }
				: {}),
			...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
			abortSignal: opts.abortSignal,
			stopWhen: stopWhenCondition,
			...(prepareStep ? { prepareStep } : {}),
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK callback types mismatch
			onStepFinish: onStepFinish as any,
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK callback types mismatch
			onError: onError as any,
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK callback types mismatch
			onAbort: onAbort as any,
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK callback types mismatch
			onFinish: onFinish as any,
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK streamText options type
		} as any);
		const tracedToolInputNamesById = new Map<string, string>();

		for await (const part of result.fullStream) {
			if (!part) continue;

			if (part.type === 'tool-input-start') {
				if (shouldTraceToolInput(part.toolName)) {
					tracedToolInputNamesById.set(part.id, part.toolName);
				}
				continue;
			}

			if (part.type === 'tool-input-delta') {
				const toolName = tracedToolInputNamesById.get(part.id);
				if (toolName) void summarizeTraceValue(part.delta);
				continue;
			}

			if (part.type === 'tool-input-end') {
				const toolName = tracedToolInputNamesById.get(part.id);
				if (toolName) {
					tracedToolInputNamesById.delete(part.id);
				}
				continue;
			}

			if (part.type === 'tool-call') {
				if (shouldTraceToolInput(part.toolName)) {
					tracedToolInputNamesById.delete(part.toolCallId);
					void summarizeTraceValue(part.input);
				}
				continue;
			}

			if (part.type === 'tool-result') {
				if (shouldTraceToolInput(part.toolName)) {
					void summarizeTraceValue(part.output);
				}
				continue;
			}

			if (part.type === 'text-delta') {
				const rawDelta = part.text;
				if (!rawDelta) continue;

				const delta = oauthTextGuard
					? consumeOauthCodexTextDelta(oauthTextGuard, rawDelta)
					: rawDelta;
				if (!delta) continue;

				accumulated += delta;
				if (accumulated.trim()) {
					latestAssistantText = accumulated;
				}
				if (accumulated.length > 0) {
					lastTextDeltaStepIndex = stepIndex;
				}
				dump?.recordTextDelta(stepIndex, accumulated);
				if (
					(delta.trim().length > 0 && _toolActivityObserved) ||
					(delta.trim().length > 0 && firstToolSeen())
				) {
					_trailingAssistantTextAfterTool = true;
					_endedWithToolActivity = false;
				}

				if (!currentPartId && !accumulated.trim()) {
					continue;
				}

				if (!firstDeltaSeen) {
					firstDeltaSeen = true;
					streamStartTimer.end();
				}

				if (!currentPartId) {
					currentPartId = crypto.randomUUID();
					sharedCtx.assistantPartId = currentPartId;
					await db.insert(messageParts).values({
						id: currentPartId,
						messageId: opts.assistantMessageId,
						index: await sharedCtx.nextIndex(),
						stepIndex: null,
						type: 'text',
						content: JSON.stringify({ text: accumulated }),
						agent: opts.agent,
						provider: opts.provider,
						model: opts.model,
						startedAt: Date.now(),
					});
				}

				publish({
					type: 'message.part.delta',
					sessionId: opts.sessionId,
					payload: {
						messageId: opts.assistantMessageId,
						partId: currentPartId,
						stepIndex,
						delta,
					},
				});
				await db
					.update(messageParts)
					.set({ content: JSON.stringify({ text: accumulated }) })
					.where(eq(messageParts.id, currentPartId));
				continue;
			}

			if (part.type === 'reasoning-start') {
				const reasoningId = part.id;
				if (!reasoningId) continue;
				await handleReasoningStart(
					reasoningId,
					part.providerMetadata,
					opts,
					db,
					sharedCtx,
					getStepIndex,
					reasoningStates,
				);
				continue;
			}

			if (part.type === 'reasoning-delta') {
				await handleReasoningDelta(
					part.id,
					part.text,
					part.providerMetadata,
					opts,
					db,
					getStepIndex,
					reasoningStates,
				);
				continue;
			}

			if (part.type === 'reasoning-end') {
				await handleReasoningEnd(part.id, db, reasoningStates);
			}
		}

		const fs = firstToolSeen();
		if (!fs && !_finishObserved) {
			publish({
				type: 'finish-step',
				sessionId: opts.sessionId,
				payload: { reason: 'no-tool-calls' },
			});
		}

		unsubscribeFinish();
		await cleanupEmptyTextParts(opts, db);
		firstToolTimer.end({ seen: firstToolSeen() });

		let streamFinishReason: string | undefined;
		try {
			streamFinishReason = await result.finishReason;
		} catch {
			streamFinishReason = undefined;
		}

		let streamRawFinishReason: string | undefined;
		try {
			streamRawFinishReason = await result.rawFinishReason;
		} catch {
			streamRawFinishReason = undefined;
		}

		if (dump) {
			const finalTextSnapshot = latestAssistantText || accumulated;
			if (finalTextSnapshot.length > 0) {
				dump.recordTextDelta(
					lastTextDeltaStepIndex ?? stepIndex,
					finalTextSnapshot,
					{ force: true },
				);
			}
			dump.recordStreamEnd({
				finishReason: streamFinishReason,
				rawFinishReason: streamRawFinishReason,
				finishObserved: _finishObserved,
				aborted: _abortedByUser,
			});
		}
	} catch (err) {
		unsubscribeFinish();
		dump?.recordError(err);
		const payload = toErrorPayload(err);

		const errorMessage = err instanceof Error ? err.message : String(err);
		const errorCode = (err as { code?: string })?.code ?? '';
		const responseBody = (err as { responseBody?: string })?.responseBody ?? '';
		const apiErrorType = (err as { apiErrorType?: string })?.apiErrorType ?? '';
		const combinedError = `${errorMessage} ${responseBody}`.toLowerCase();

		const isPromptTooLong =
			combinedError.includes('prompt is too long') ||
			combinedError.includes('maximum context length') ||
			combinedError.includes('too many tokens') ||
			combinedError.includes('context_length_exceeded') ||
			combinedError.includes('request too large') ||
			combinedError.includes('exceeds the model') ||
			combinedError.includes('input is too long') ||
			errorCode === 'context_length_exceeded' ||
			apiErrorType === 'invalid_request_error';

		if (isPromptTooLong && !opts.isCompactCommand) {
			try {
				const pruneResult = await pruneSession(db, opts.sessionId);
				void pruneResult;

				publish({
					type: 'error',
					sessionId: opts.sessionId,
					payload: {
						...payload,
						message: `Context too large. Auto-compacted old tool results. Please retry your message.`,
						name: 'ContextOverflow',
					},
				});

				try {
					await completeAssistantMessage({}, opts, db);
				} catch {}
				return;
			} catch {}
		}
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload,
		});

		try {
			await updateSessionTokensIncremental(
				{ inputTokens: 0, outputTokens: 0 },
				undefined,
				opts,
				db,
			);
			await updateMessageTokensIncremental(
				{ inputTokens: 0, outputTokens: 0 },
				undefined,
				opts,
				db,
			);
			await completeAssistantMessage({}, opts, db);
		} catch {}
		throw err;
	} finally {
		if (dump) {
			try {
				await dump.flush(cfg.projectRoot);
			} catch {}
		}
	}
}
