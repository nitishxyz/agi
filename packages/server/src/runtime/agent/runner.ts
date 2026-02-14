import { hasToolCall, stepCountIs, streamText } from 'ai';
import { messages, messageParts } from '@ottocode/database/schema';
import { eq } from 'drizzle-orm';
import { publish, subscribe } from '../../events/bus.ts';
import { debugLog, time } from '../debug/index.ts';
import { toErrorPayload } from '../errors/handling.ts';
import {
	type RunOpts,
	enqueueAssistantRun,
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
import { decideOauthCodexContinuation } from './oauth-codex-continuation.ts';

export {
	enqueueAssistantRun,
	abortSession,
	abortMessage,
	removeFromQueue,
	getQueueState,
	getRunnerState,
} from '../session/queue.ts';

export async function runSessionLoop(sessionId: string) {
	setRunning(sessionId, true);

	while (true) {
		const job = await dequeueJob(sessionId);
		if (!job) break;

		try {
			await runAssistant(job);
		} catch (_err) {
			debugLog(
				`[RUNNER] runAssistant threw (swallowed to keep loop alive): ${_err instanceof Error ? _err.message : String(_err)}`,
			);
		}
	}

	setRunning(sessionId, false);
	cleanupSession(sessionId);
}

async function runAssistant(opts: RunOpts) {
	const separator = '='.repeat(72);
	debugLog(separator);
	debugLog(
		`[RUNNER] Starting turn for session ${opts.sessionId}, message ${opts.assistantMessageId}`,
	);

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

	debugLog(
		`[RUNNER] messagesWithSystemInstructions length: ${messagesWithSystemInstructions.length}`,
	);

	let _finishObserved = false;
	const unsubscribeFinish = subscribe(opts.sessionId, (evt) => {
		if (evt.type !== 'tool.result') return;
		try {
			const name = (evt.payload as { name?: string } | undefined)?.name;
			if (name === 'finish') _finishObserved = true;
		} catch (err) {
			debugLog(
				`[RUNNER] finish observer error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;

	let currentPartId: string | null = null;
	let accumulated = '';
	let latestAssistantText = '';
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

	const reasoningStates = new Map<string, ReasoningState>();

	const onStepFinish = createStepFinishHandler(
		opts,
		db,
		getStepIndex,
		incrementStepIndex,
		getCurrentPartId,
		updateCurrentPartId,
		updateAccumulated,
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

	const onAbort = createAbortHandler(opts, db, getStepIndex, sharedCtx);

	const onFinish = createFinishHandler(opts, db, completeAssistantMessage);
	const stopWhenCondition = isOpenAIOAuth
		? stepCountIs(48)
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

		for await (const part of result.fullStream) {
			if (!part) continue;

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

				if (!currentPartId && !accumulated.trim()) {
					continue;
				}

				if (!firstDeltaSeen) {
					firstDeltaSeen = true;
					streamStartTimer.end();
					if (isFirstMessage) {
						void triggerDeferredTitleGeneration({
							cfg,
							db,
							sessionId: opts.sessionId,
						});
					}
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
		if (oauthTextGuard?.dropped) {
			debugLog(
				'[RUNNER] Dropped pseudo tool-call text leaked by OpenAI OAuth stream',
			);
		}
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

		debugLog(
			`[RUNNER] Stream finished. finishSeen=${_finishObserved}, firstToolSeen=${fs}, finishReason=${streamFinishReason}, rawFinishReason=${streamRawFinishReason}`,
		);

		const MAX_CONTINUATIONS = 6;
		const continuationCount = opts.continuationCount ?? 0;
		const continuationDecision = decideOauthCodexContinuation({
			provider: opts.provider,
			isOpenAIOAuth,
			finishObserved: _finishObserved,
			continuationCount,
			maxContinuations: MAX_CONTINUATIONS,
			finishReason: streamFinishReason,
			rawFinishReason: streamRawFinishReason,
			firstToolSeen: fs,
			droppedPseudoToolText: oauthTextGuard?.dropped ?? false,
			lastAssistantText: latestAssistantText,
		});

		if (continuationDecision.shouldContinue) {
			debugLog(
				`[RUNNER] WARNING: Stream ended without finish. reason=${continuationDecision.reason ?? 'unknown'}, finishReason=${streamFinishReason}, rawFinishReason=${streamRawFinishReason}, firstToolSeen=${fs}. Auto-continuing.`,
			);

			debugLog(
				`[RUNNER] Auto-continuing (${continuationCount + 1}/${MAX_CONTINUATIONS})...`,
			);

			try {
				await completeAssistantMessage({}, opts, db);
			} catch (err) {
				debugLog(
					`[RUNNER] completeAssistantMessage failed before continuation: ${err instanceof Error ? err.message : String(err)}`,
				);
			}

			const continuationMessageId = crypto.randomUUID();
			await db.insert(messages).values({
				id: continuationMessageId,
				sessionId: opts.sessionId,
				role: 'assistant',
				status: 'pending',
				agent: opts.agent,
				provider: opts.provider,
				model: opts.model,
				createdAt: Date.now(),
			});

			publish({
				type: 'message.created',
				sessionId: opts.sessionId,
				payload: { id: continuationMessageId, role: 'assistant' },
			});

			enqueueAssistantRun(
				{
					...opts,
					assistantMessageId: continuationMessageId,
					continuationCount: continuationCount + 1,
				},
				runSessionLoop,
			);
			return;
		}
		if (
			continuationDecision.reason === 'max-continuations-reached' &&
			!_finishObserved
		) {
			debugLog(
				`[RUNNER] Max continuations (${MAX_CONTINUATIONS}) reached, stopping.`,
			);
		}
	} catch (err) {
		unsubscribeFinish();
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

		debugLog(
			`[RUNNER] isPromptTooLong: ${isPromptTooLong}, isCompactCommand: ${opts.isCompactCommand}`,
		);

		if (isPromptTooLong && !opts.isCompactCommand) {
			debugLog('[RUNNER] Prompt too long - auto-compacting');
			try {
				const pruneResult = await pruneSession(db, opts.sessionId);
				debugLog(
					`[RUNNER] Auto-pruned ${pruneResult.pruned} parts, saved ~${pruneResult.saved} tokens`,
				);

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
				} catch (err2) {
					debugLog(
						`[RUNNER] completeAssistantMessage failed after prune: ${err2 instanceof Error ? err2.message : String(err2)}`,
					);
				}
				return;
			} catch (pruneErr) {
				debugLog(
					`[RUNNER] Auto-prune failed: ${pruneErr instanceof Error ? pruneErr.message : String(pruneErr)}`,
				);
			}
		}

		debugLog(`[RUNNER] Error during stream: ${payload.message}`);
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
		} catch (err2) {
			debugLog(
				`[RUNNER] Failed to complete message after error: ${err2 instanceof Error ? err2.message : String(err2)}`,
			);
		}
		throw err;
	} finally {
		debugLog(
			`[RUNNER] Turn complete for session ${opts.sessionId}, message ${opts.assistantMessageId}`,
		);
		debugLog(separator);
	}
}
