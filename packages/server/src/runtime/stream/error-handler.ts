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
import { clearPendingTopup } from '../topup/manager.ts';

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
		const causeError = errObj?.cause as Record<string, unknown> | undefined;
		
		// Check for SETU_FIAT_SELECTED code specifically (not string matching)
		const errorCode =
			(errObj?.code as string) ??
			(errObj?.error as Record<string, unknown>)?.code as string ??
			((errObj?.error as Record<string, unknown>)?.error as Record<string, unknown>)?.code as string ??
			(errObj?.data as Record<string, unknown>)?.code as string ??
			(errObj?.cause as Record<string, unknown>)?.code as string ??
			((errObj?.cause as Record<string, unknown>)?.error as Record<string, unknown>)?.code as string ??
			(nestedError?.code as string) ??
			(causeError?.code as string) ??
			'';
		
		// Also check error message for the exact fiat selection message
		const errorMessage =
			(errObj?.message as string) ??
			(errObj?.error as Record<string, unknown>)?.message as string ??
			((errObj?.error as Record<string, unknown>)?.error as Record<string, unknown>)?.message as string ??
			(errObj?.data as Record<string, unknown>)?.message as string ??
			(errObj?.cause as Record<string, unknown>)?.message as string ??
			((errObj?.cause as Record<string, unknown>)?.error as Record<string, unknown>)?.message as string ??
			(nestedError?.message as string) ??
			(causeError?.message as string) ??
			'';
		
		// Also do a JSON stringify check specifically for the code
		const fullErrorStr = JSON.stringify(err);
		const hasSetuFiatCode = fullErrorStr.includes('"code":"SETU_FIAT_SELECTED"') ||
			fullErrorStr.includes("'code':'SETU_FIAT_SELECTED'");
		
		// Only match if the error code is SETU_FIAT_SELECTED OR the exact error message
		const isFiatSelected =
			errorCode === 'SETU_FIAT_SELECTED' ||
			errorMessage === 'Setu: fiat payment selected' ||
			hasSetuFiatCode;

		// Handle fiat payment selected - this is not an error, just a signal to pause
		if (isFiatSelected) {
			debugLog('[stream-handlers] Fiat payment selected, pausing request');
			clearPendingTopup(opts.sessionId);

		// Add a helpful message part telling user to complete payment
		const partId = crypto.randomUUID();
		await db.insert(messageParts).values({
			id: partId,
			messageId: opts.assistantMessageId,
			index: await sharedCtx.nextIndex(),
		stepIndex: getStepIndex(),
		type: 'error',
		content: JSON.stringify({
			message: 'Balance too low — Complete your top-up, then retry.',
			type: 'balance_low',
			errorType: 'balance_low',
			isRetryable: true,
		}),
		agent: opts.agent,
		provider: opts.provider,
				model: opts.model,
				startedAt: Date.now(),
				completedAt: Date.now(),
			});

			// Mark the message as completed (not error, not pending)
			await db
				.update(messages)
				.set({
					status: 'complete',
					completedAt: Date.now(),
					error: null,
					errorType: null,
					errorDetails: null,
				})
				.where(eq(messages.id, opts.assistantMessageId));

			// Emit the message part
			publish({
				type: 'message.part.delta',
				sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
			partId,
			type: 'error',
			content: JSON.stringify({
				message: 'Balance too low — Complete your top-up, then retry.',
				type: 'balance_low',
				errorType: 'balance_low',
				isRetryable: true,
			}),
		},
	});

			// Emit message completed
			publish({
				type: 'message.completed',
				sessionId: opts.sessionId,
				payload: {
					id: opts.assistantMessageId,
					fiatTopupRequired: true,
				},
			});

			// Emit a special event so UI knows to show topup modal
			publish({
				type: 'setu.fiat.checkout_created',
				sessionId: opts.sessionId,
				payload: {
					messageId: opts.assistantMessageId,
					needsTopup: true,
				},
			});

			return;
		}

		const errorType =
			(errObj?.apiErrorType as string) ?? (nestedError?.type as string) ?? '';
		const fullErrorStrLower = JSON.stringify(err).toLowerCase();

		const isPromptTooLong =
			fullErrorStrLower.includes('prompt is too long') ||
			fullErrorStrLower.includes('maximum context length') ||
			fullErrorStrLower.includes('too many tokens') ||
			fullErrorStrLower.includes('context_length_exceeded') ||
			fullErrorStrLower.includes('request too large') ||
			fullErrorStrLower.includes('exceeds the model') ||
			fullErrorStrLower.includes('context window') ||
			fullErrorStrLower.includes('input is too long') ||
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
