import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { publish } from '../../events/bus.ts';
import { estimateModelCostUsd } from '@agi-cli/sdk';
import type { RunOpts } from '../session/queue.ts';
import {
	pruneSession,
	isOverflow,
	getModelLimits,
	type TokenUsage,
	markSessionCompacted,
} from '../message/compaction.ts';
import { debugLog } from '../debug/index.ts';
import type { FinishEvent } from './types.ts';

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
		try {
			await completeAssistantMessageFn(fin, opts, db);
		} catch {}

		if (opts.isCompactCommand && fin.finishReason !== 'error') {
			const assistantParts = await db
				.select()
				.from(messageParts)
				.where(eq(messageParts.messageId, opts.assistantMessageId));
			const hasTextContent = assistantParts.some(
				(p) => p.type === 'text' && p.content && p.content !== '{"text":""}',
			);

			if (!hasTextContent) {
				debugLog(
					'[stream-handlers] /compact finished but no summary generated, skipping compaction marking',
				);
			} else {
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
		}

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
