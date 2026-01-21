import { hasToolCall, streamText } from 'ai';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { publish, subscribe } from '../../events/bus.ts';
import { debugLog, time } from '../debug/index.ts';
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
import { setupRunner } from './runner-setup.ts';
import {
	type ReasoningState,
	serializeReasoningContent,
	handleReasoningStart,
	handleReasoningDelta,
	handleReasoningEnd,
} from './runner-reasoning.ts';

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
			// Swallow to keep the loop alive; event published by runner
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
		db,
		history,
		system,
		additionalSystemMessages,
		model,
		effectiveMaxOutputTokens,
		toolset,
		sharedCtx,
		firstToolTimer,
		firstToolSeen,
		providerOptions,
	} = setup;

	const isFirstMessage = !history.some((m) => m.role === 'assistant');

	const messagesWithSystemInstructions: Array<{
		role: string;
		content: string | Array<unknown>;
	}> = [...additionalSystemMessages, ...history];

	if (!isFirstMessage) {
		messagesWithSystemInstructions.push({
			role: 'user',
			content:
				'SYSTEM REMINDER: You are continuing an existing session. When you have completed the task, you MUST stream a text summary of what you did to the user, and THEN call the `finish` tool. Do not call `finish` without a summary.',
		});
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
		} catch {}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;

	let currentPartId: string | null = null;
	let accumulated = '';
	let stepIndex = 0;

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

	try {
		// biome-ignore lint/suspicious/noExplicitAny: AI SDK message types are complex
		const result = streamText({
			model,
			tools: toolset,
			...(system ? { system } : {}),
			messages: messagesWithSystemInstructions as any,
			...(effectiveMaxOutputTokens
				? { maxOutputTokens: effectiveMaxOutputTokens }
				: {}),
			...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
			abortSignal: opts.abortSignal,
			stopWhen: hasToolCall('finish'),
			onStepFinish: onStepFinish as any,
			onError: onError as any,
			onAbort: onAbort as any,
			onFinish: onFinish as any,
		} as any);

		for await (const part of result.fullStream) {
			if (!part) continue;

			if (part.type === 'text-delta') {
				const delta = part.text;
				if (!delta) continue;
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
						content: JSON.stringify({ text: '' }),
						agent: opts.agent,
						provider: opts.provider,
						model: opts.model,
						startedAt: Date.now(),
					});
				}

				accumulated += delta;
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

		debugLog(
			`[RUNNER] Stream finished. finishSeen=${_finishObserved}, firstToolSeen=${fs}`,
		);
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
				} catch {}
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
		} catch {}
		throw err;
	} finally {
		debugLog(
			`[RUNNER] Turn complete for session ${opts.sessionId}, message ${opts.assistantMessageId}`,
		);
		debugLog(separator);
	}
}
