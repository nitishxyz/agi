import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { APICallError } from 'ai';
import { publish } from '../events/bus.ts';
import { estimateModelCostUsd } from '@agi-cli/sdk';
import { toErrorPayload } from './error-handling.ts';
import type { RunOpts } from './session-queue.ts';
import type { ToolAdapterContext } from '../tools/adapter.ts';

interface ProviderMetadata {
	openai?: {
		cachedPromptTokens?: number;
	};
	[key: string]: unknown;
}

interface UsageData {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cachedInputTokens?: number;
	reasoningTokens?: number;
}

type StepFinishEvent = {
	usage?: UsageData;
	finishReason?: string;
	response?: unknown;
	experimental_providerMetadata?: ProviderMetadata;
};

type FinishEvent = {
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
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
	getCurrentPartId: () => string,
	getStepIndex: () => number,
	_sharedCtx: ToolAdapterContext,
	_updateCurrentPartId: (id: string) => void,
	_updateAccumulated: (text: string) => void,
	incrementStepIndex: () => number,
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
			await db
				.update(messageParts)
				.set({ completedAt: finishedAt })
				.where(eq(messageParts.id, currentPartId));
		} catch (err) {
			console.error('[createStepFinishHandler] Failed to update part', err);
		}

		// Update tokens incrementally
		if (step.usage) {
			try {
				await updateSessionTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
				await updateMessageTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
			} catch (err) {
				console.error('[createStepFinishHandler] Token update failed', err);
			}
		}

		// Publish step-finished event
		publish('stream:step-finished', {
			sessionId: opts.sessionId,
			messageId: opts.assistantMessageId,
			assistantMessageId: opts.assistantMessageId,
			stepIndex,
			finishReason: step.finishReason,
			usage: step.usage,
		});

		incrementStepIndex();
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
	_getAccumulated: () => string,
	_abortController: AbortController,
) {
	return async (fin: FinishEvent) => {
		try {
			await completeAssistantMessageFn(fin, opts, db);

			const msgRows = await db
				.select()
				.from(messages)
				.where(eq(messages.id, opts.assistantMessageId));

			let estimatedCost = 0;
			if (msgRows.length > 0 && msgRows[0]) {
				const msg = msgRows[0];
				estimatedCost = estimateModelCostUsd(
					opts.provider,
					opts.model,
					Number(msg.promptTokens ?? 0),
					Number(msg.completionTokens ?? 0),
				);
			}

			publish('stream:finished', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				assistantMessageId: opts.assistantMessageId,
				usage: fin.usage,
				finishReason: fin.finishReason,
				estimatedCost,
			});
		} catch (err) {
			console.error('[createFinishHandler] Error in onFinish', err);
			publish('stream:error', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				error: toErrorPayload(err),
			});
		}
	};
}

/**
 * Creates the onAbort handler for the stream
 */
export function createAbortHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	_abortController: AbortController,
) {
	return async (_event: AbortEvent) => {
		try {
			await db
				.update(messages)
				.set({ status: 'aborted', finishedAt: new Date() })
				.where(eq(messages.id, opts.assistantMessageId));

			publish('stream:aborted', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				assistantMessageId: opts.assistantMessageId,
			});
		} catch (err) {
			console.error('[createAbortHandler] Error in onAbort', err);
		}
	};
}

/**
 * Creates the error handler for the stream
 */
export function createErrorHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	return async (err: unknown) => {
		console.error('[createErrorHandler] Stream error:', err);

		try {
			let errorMessage = 'Unknown error';
			let errorType = 'UNKNOWN_ERROR';
			let errorStack: string | undefined;

			if (err instanceof APICallError) {
				errorMessage = err.message;
				errorType = 'API_CALL_ERROR';
				errorStack = err.stack;
			} else if (err instanceof Error) {
				errorMessage = err.message;
				errorType = err.name || 'ERROR';
				errorStack = err.stack;
			} else if (typeof err === 'string') {
				errorMessage = err;
			}

			await db
				.update(messages)
				.set({
					status: 'error',
					finishedAt: new Date(),
					error: errorMessage,
				})
				.where(eq(messages.id, opts.assistantMessageId));

			publish('stream:error', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				assistantMessageId: opts.assistantMessageId,
				error: {
					message: errorMessage,
					type: errorType,
					stack: errorStack,
				},
			});
		} catch (dbErr) {
			console.error('[createErrorHandler] Failed to save error to DB', dbErr);
		}
	};
}

/**
 * Creates the text delta handler for the stream
 */
export function createTextHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getCurrentPartId: () => string,
	getStepIndex: () => number,
	_updateCurrentPartId: (id: string) => void,
	updateAccumulated: (text: string) => void,
	getAccumulated: () => string,
) {
	return async (textDelta: string) => {
		const currentPartId = getCurrentPartId();
		const stepIndex = getStepIndex();

		// Accumulate the text
		const accumulated = getAccumulated() + textDelta;
		updateAccumulated(accumulated);

		try {
			if (currentPartId) {
				await db
					.update(messageParts)
					.set({ content: accumulated })
					.where(eq(messageParts.id, currentPartId));
			}

			publish('stream:text-delta', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				assistantMessageId: opts.assistantMessageId,
				stepIndex,
				textDelta,
				fullText: accumulated,
			});
		} catch (err) {
			console.error('[createTextHandler] Error updating text part', err);
		}
	};
}
