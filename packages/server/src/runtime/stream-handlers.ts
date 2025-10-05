import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { APICallError } from 'ai';
import { publish } from '../events/bus.ts';
import { estimateModelCostUsd } from '@agi-cli/providers';
import { toErrorPayload } from './error-handling.ts';
import type { RunOpts } from './session-queue.ts';
import type { ToolAdapterContext } from '../tools/adapter.ts';

type StepFinishEvent = {
	usage?: { inputTokens?: number; outputTokens?: number };
	finishReason?: string;
	response?: unknown;
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
	sharedCtx: ToolAdapterContext,
	updateCurrentPartId: (id: string) => void,
	updateAccumulated: (text: string) => void,
	incrementStepIndex: () => number,
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
		} catch {}

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
			const newStepIndex = incrementStepIndex();
			const newPartId = crypto.randomUUID();
			const index = await sharedCtx.nextIndex();
			const nowTs = Date.now();
			await db.insert(messageParts).values({
				id: newPartId,
				messageId: opts.assistantMessageId,
				index,
				stepIndex: newStepIndex,
				type: 'text',
				content: JSON.stringify({ text: '' }),
				agent: opts.agent,
				provider: opts.provider,
				model: opts.model,
				startedAt: nowTs,
			});
			updateCurrentPartId(newPartId);
			sharedCtx.assistantPartId = newPartId;
			sharedCtx.stepIndex = newStepIndex;
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
	ensureFinishToolCalled: () => Promise<void>,
	updateSessionTokensFn: (
		fin: FinishEvent,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
	completeAssistantMessageFn: (
		fin: FinishEvent,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
) {
	return async (fin: FinishEvent) => {
		try {
			await ensureFinishToolCalled();
		} catch {}

		try {
			await updateSessionTokensFn(fin, opts, db);
		} catch {}

		try {
			await completeAssistantMessageFn(fin, opts, db);
		} catch {}

		const costUsd = fin.usage
			? estimateModelCostUsd(opts.provider, opts.model, fin.usage)
			: undefined;
		publish({
			type: 'message.completed',
			sessionId: opts.sessionId,
			payload: {
				id: opts.assistantMessageId,
				usage: fin.usage,
				costUsd,
				finishReason: fin.finishReason,
			},
		});
	};
}
