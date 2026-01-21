import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { APICallError } from 'ai';
import { publish } from '../../events/bus.ts';
import { toErrorPayload } from '../errors/handling.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';
import { pruneSession, performAutoCompaction } from '../message/compaction.ts';
import { debugLog } from '../debug/index.ts';
import { enqueueAssistantRun } from '../session/queue.ts';

export function createErrorHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	sharedCtx: ToolAdapterContext,
	retryCallback?: (sessionId: string) => Promise<void>,
) {
	return async (err: unknown) => {
		const errorPayload = toErrorPayload(err);
		const isApiError = APICallError.isInstance(err);
		const stepIndex = getStepIndex();

		const errObj = err as Record<string, unknown>;
		const nestedError = (errObj?.error as Record<string, unknown>)?.error as
			| Record<string, unknown>
			| undefined;
		const errorCode =
			(errObj?.code as string) ?? (nestedError?.code as string) ?? '';
		const errorType =
			(errObj?.apiErrorType as string) ?? (nestedError?.type as string) ?? '';
		const fullErrorStr = JSON.stringify(err).toLowerCase();

		const isPromptTooLong =
			fullErrorStr.includes('prompt is too long') ||
			fullErrorStr.includes('maximum context length') ||
			fullErrorStr.includes('too many tokens') ||
			fullErrorStr.includes('context_length_exceeded') ||
			fullErrorStr.includes('request too large') ||
			fullErrorStr.includes('exceeds the model') ||
			fullErrorStr.includes('context window') ||
			fullErrorStr.includes('input is too long') ||
			errorCode === 'context_length_exceeded' ||
			errorType === 'invalid_request_error';

		debugLog(
			`[stream-handlers] isPromptTooLong: ${isPromptTooLong}, errorCode: ${errorCode}, errorType: ${errorType}`,
		);

		if (isPromptTooLong && !opts.isCompactCommand) {
			debugLog(
				'[stream-handlers] Prompt too long detected, auto-compacting...',
			);
			let compactionSucceeded = false;
			try {
				const publishWrapper = (event: {
					type: string;
					sessionId: string;
					payload: Record<string, unknown>;
				}) => {
					publish(event as Parameters<typeof publish>[0]);
				};
				const compactResult = await performAutoCompaction(
					db,
					opts.sessionId,
					opts.assistantMessageId,
					publishWrapper,
					opts.provider,
					opts.model,
				);
				if (compactResult.success) {
					debugLog(
						`[stream-handlers] Auto-compaction succeeded: ${compactResult.summary?.slice(0, 100)}...`,
					);
					compactionSucceeded = true;
				} else {
					debugLog(
						`[stream-handlers] Auto-compaction failed: ${compactResult.error}, falling back to prune`,
					);
					const pruneResult = await pruneSession(db, opts.sessionId);
					debugLog(
						`[stream-handlers] Fallback pruned ${pruneResult.pruned} parts, saved ~${pruneResult.saved} tokens`,
					);
					compactionSucceeded = pruneResult.pruned > 0;
				}
			} catch (compactErr) {
				debugLog(
					`[stream-handlers] Auto-compact error: ${compactErr instanceof Error ? compactErr.message : String(compactErr)}`,
				);
			}

			if (compactionSucceeded) {
				await db
					.update(messages)
					.set({
						status: 'completed',
					})
					.where(eq(messages.id, opts.assistantMessageId));

				publish({
					type: 'message.completed',
					sessionId: opts.sessionId,
					payload: {
						id: opts.assistantMessageId,
						autoCompacted: true,
					},
				});

				if (retryCallback) {
					debugLog('[stream-handlers] Triggering retry after compaction...');
					const newAssistantMessageId = crypto.randomUUID();
					await db.insert(messages).values({
						id: newAssistantMessageId,
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
						payload: { id: newAssistantMessageId, role: 'assistant' },
					});

					enqueueAssistantRun(
						{
							...opts,
							assistantMessageId: newAssistantMessageId,
						},
						retryCallback,
					);
				} else {
					debugLog(
						'[stream-handlers] No retryCallback provided, cannot auto-retry',
					);
				}

				return;
			}
		}

		const errorPartId = crypto.randomUUID();
		const displayMessage =
			isPromptTooLong && !opts.isCompactCommand
				? `${errorPayload.message}. Context auto-compacted - please retry your message.`
				: errorPayload.message;
		await db.insert(messageParts).values({
			id: errorPartId,
			messageId: opts.assistantMessageId,
			index: await sharedCtx.nextIndex(),
			stepIndex,
			type: 'error',
			content: JSON.stringify({
				message: displayMessage,
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

		await db
			.update(messages)
			.set({
				status: 'error',
				error: displayMessage,
				errorType: errorPayload.type,
				errorDetails: JSON.stringify({
					...errorPayload.details,
					isApiError,
					autoCompacted: isPromptTooLong && !opts.isCompactCommand,
				}),
				isAborted: false,
			})
			.where(eq(messages.id, opts.assistantMessageId));

		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
				partId: errorPartId,
				error: displayMessage,
				errorType: errorPayload.type,
				details: errorPayload.details,
				isAborted: false,
				autoCompacted: isPromptTooLong && !opts.isCompactCommand,
			},
		});
	};
}
