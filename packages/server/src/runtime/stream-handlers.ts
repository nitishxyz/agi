import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { APICallError } from 'ai';
import { publish } from '../events/bus.ts';
import { estimateModelCostUsd } from '@agi-cli/sdk';
import { toErrorPayload } from './error-handling.ts';
import type { RunOpts } from './session-queue.ts';
import type { ToolAdapterContext } from '../tools/adapter.ts';
import type { ProviderMetadata, UsageData } from './db-operations.ts';
import {
	pruneSession,
	isOverflow,
	getModelLimits,
	type TokenUsage,
	markSessionCompacted,
} from './compaction.ts';
import { debugLog } from './debug.ts';

type StepFinishEvent = {
	usage?: UsageData;
	finishReason?: string;
	response?: unknown;
	experimental_providerMetadata?: ProviderMetadata;
};

type FinishEvent = {
	usage?: Pick<UsageData, 'inputTokens' | 'outputTokens' | 'totalTokens'>;
	finishReason?: string;
};

type AbortEvent = {
	steps: unknown[];
};

/**
 * Creates the onStepFinish handler for the stream
 */
export function createStepFinishHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	incrementStepIndex: () => number,
	getCurrentPartId: () => string | null,
	updateCurrentPartId: (id: string | null) => void,
	updateAccumulated: (text: string) => void,
	sharedCtx: ToolAdapterContext,
	updateSessionTokensIncrementalFn: (
		usage: UsageData,
		providerMetadata: ProviderMetadata | undefined,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
	updateMessageTokensIncrementalFn: (
		usage: UsageData,
		providerMetadata: ProviderMetadata | undefined,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
) {
	return async (step: StepFinishEvent) => {
		const finishedAt = Date.now();
		const currentPartId = getCurrentPartId();
		const stepIndex = getStepIndex();

		try {
			if (currentPartId) {
				await db
					.update(messageParts)
					.set({ completedAt: finishedAt })
					.where(eq(messageParts.id, currentPartId));
			}
		} catch {}

		// Update token counts incrementally after each step
		if (step.usage) {
			try {
				await updateSessionTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
			} catch {}

			try {
				await updateMessageTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
			} catch {}
		}

		try {
			publish({
				type: 'finish-step',
				sessionId: opts.sessionId,
				payload: {
					stepIndex,
					usage: step.usage,
					finishReason: step.finishReason,
					response: step.response,
				},
			});
			if (step.usage) {
				publish({
					type: 'usage',
					sessionId: opts.sessionId,
					payload: { stepIndex, ...step.usage },
				});
			}
		} catch {}

		try {
			// Increment step index but defer creating the new text part
			// until we actually get a text-delta (so reasoning blocks can complete first)
			const newStepIndex = incrementStepIndex();
			sharedCtx.stepIndex = newStepIndex;
			updateCurrentPartId(null); // Signal that next text-delta should create new part
			updateAccumulated('');
		} catch {}
	};
}

/**
 * Creates the onError handler for the stream
 */
export function createErrorHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	sharedCtx: ToolAdapterContext,
) {
	return async (err: unknown) => {
		const errorPayload = toErrorPayload(err);
		const isApiError = APICallError.isInstance(err);
		const stepIndex = getStepIndex();

		// Create error part for UI display
		const errorPartId = crypto.randomUUID();
		await db.insert(messageParts).values({
			id: errorPartId,
			messageId: opts.assistantMessageId,
			index: await sharedCtx.nextIndex(),
			stepIndex,
			type: 'error',
			content: JSON.stringify({
				message: errorPayload.message,
				type: errorPayload.type,
				details: errorPayload.details,
				isAborted: false,
			}),
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
			startedAt: Date.now(),
			completedAt: Date.now(),
		});

		// Update message status
		await db
			.update(messages)
			.set({
				status: 'error',
				error: errorPayload.message,
				errorType: errorPayload.type,
				errorDetails: JSON.stringify({
					...errorPayload.details,
					isApiError,
				}),
				isAborted: false,
			})
			.where(eq(messages.id, opts.assistantMessageId));

		// Publish enhanced error event
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
				partId: errorPartId,
				error: errorPayload.message,
				errorType: errorPayload.type,
				details: errorPayload.details,
				isAborted: false,
			},
		});
	};
}

/**
 * Creates the onAbort handler for the stream
 */
export function createAbortHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	sharedCtx: ToolAdapterContext,
) {
	return async ({ steps }: AbortEvent) => {
		const stepIndex = getStepIndex();

		// Create abort part for UI
		const abortPartId = crypto.randomUUID();
		await db.insert(messageParts).values({
			id: abortPartId,
			messageId: opts.assistantMessageId,
			index: await sharedCtx.nextIndex(),
			stepIndex,
			type: 'error',
			content: JSON.stringify({
				message: 'Generation stopped by user',
				type: 'abort',
				isAborted: true,
				stepsCompleted: steps.length,
			}),
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
			startedAt: Date.now(),
			completedAt: Date.now(),
		});

		// Store abort info
		await db
			.update(messages)
			.set({
				status: 'error',
				error: 'Generation stopped by user',
				errorType: 'abort',
				errorDetails: JSON.stringify({
					stepsCompleted: steps.length,
					abortedAt: Date.now(),
				}),
				isAborted: true,
			})
			.where(eq(messages.id, opts.assistantMessageId));

		// Publish abort event
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
				partId: abortPartId,
				error: 'Generation stopped by user',
				errorType: 'abort',
				isAborted: true,
				stepsCompleted: steps.length,
			},
		});
	};
}

/**
 * Creates the onFinish handler for the stream
 */
export function createFinishHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	completeAssistantMessageFn: (
		fin: FinishEvent,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
) {
	return async (fin: FinishEvent) => {
		// Note: Token updates are handled incrementally in onStepFinish
		// Do NOT add fin.usage here as it would cause double-counting

		try {
			await completeAssistantMessageFn(fin, opts, db);
		} catch {}

		// If this was a /compact command, mark old parts as compacted
		if (opts.isCompactCommand) {
			try {
				debugLog(
					`[stream-handlers] /compact complete, marking session compacted`,
				);
				const result = await markSessionCompacted(
					db,
					opts.sessionId,
					opts.assistantMessageId,
				);
				debugLog(
					`[stream-handlers] Compacted ${result.compacted} parts, saved ~${result.saved} tokens`,
				);
			} catch (err) {
				debugLog(
					`[stream-handlers] Compaction failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		// Use session totals from DB for accurate cost calculation
		const sessRows = await db
			.select()
			.from(messages)
			.where(eq(messages.id, opts.assistantMessageId));

		const usage = sessRows[0]
			? {
					inputTokens: Number(sessRows[0].promptTokens ?? 0),
					outputTokens: Number(sessRows[0].completionTokens ?? 0),
					totalTokens: Number(sessRows[0].totalTokens ?? 0),
					cachedInputTokens: Number(sessRows[0].cachedInputTokens ?? 0),
				}
			: fin.usage;

		const costUsd = usage
			? estimateModelCostUsd(opts.provider, opts.model, usage)
			: undefined;

		// Check for context overflow and prune if needed
		if (usage) {
			try {
				const limits = getModelLimits(opts.provider, opts.model);
				if (limits) {
					const tokenUsage: TokenUsage = {
						input: usage.inputTokens ?? 0,
						output: usage.outputTokens ?? 0,
						cacheRead:
							(usage as { cachedInputTokens?: number }).cachedInputTokens ?? 0,
					};

					if (isOverflow(tokenUsage, limits)) {
						debugLog(
							`[stream-handlers] Context overflow detected, triggering prune for session ${opts.sessionId}`,
						);
						// Prune asynchronously - don't block the finish handler
						pruneSession(db, opts.sessionId).catch((err) => {
							debugLog(
								`[stream-handlers] Prune failed: ${err instanceof Error ? err.message : String(err)}`,
							);
						});
					}
				}
			} catch (err) {
				debugLog(
					`[stream-handlers] Overflow check failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		publish({
			type: 'message.completed',
			sessionId: opts.sessionId,
			payload: {
				id: opts.assistantMessageId,
				usage,
				costUsd,
				finishReason: fin.finishReason,
			},
		});
	};
}
