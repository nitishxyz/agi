import type { getDb } from '@ottocode/database';
import { messages, messageParts } from '@ottocode/database/schema';
import { eq, asc, and, lt } from 'drizzle-orm';
import { debugLog } from '../debug/index.ts';
import { estimateTokens, PRUNE_PROTECT } from './compaction-limits.ts';

const PROTECTED_TOOLS = ['skill'];

export async function markSessionCompacted(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	compactMessageId: string,
): Promise<{ compacted: number; saved: number }> {
	debugLog(`[compaction] Marking session ${sessionId} as compacted`);

	const compactMsg = await db
		.select()
		.from(messages)
		.where(eq(messages.id, compactMessageId))
		.limit(1);

	if (!compactMsg.length) {
		debugLog('[compaction] Compact message not found');
		return { compacted: 0, saved: 0 };
	}

	const cutoffTime = compactMsg[0].createdAt;

	const oldMessages = await db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.sessionId, sessionId),
				lt(messages.createdAt, cutoffTime),
			),
		)
		.orderBy(asc(messages.createdAt));

	type PartInfo = { id: string; tokens: number };
	const allToolParts: PartInfo[] = [];
	let totalToolTokens = 0;

	for (const msg of oldMessages) {
		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(asc(messageParts.index));

		for (const part of parts) {
			if (part.type !== 'tool_call' && part.type !== 'tool_result') continue;
			if (part.toolName && PROTECTED_TOOLS.includes(part.toolName)) continue;
			if (part.compactedAt) continue;

			let content: { result?: unknown; args?: unknown };
			try {
				content = JSON.parse(part.content ?? '{}');
			} catch {
				continue;
			}

			const contentStr =
				part.type === 'tool_result'
					? typeof content.result === 'string'
						? content.result
						: JSON.stringify(content.result ?? '')
					: JSON.stringify(content.args ?? '');

			const tokens = estimateTokens(contentStr);
			totalToolTokens += tokens;
			allToolParts.push({ id: part.id, tokens });
		}
	}

	const tokensToFree = Math.max(0, totalToolTokens - PRUNE_PROTECT);

	const toCompact: PartInfo[] = [];
	let freedTokens = 0;

	for (const part of allToolParts) {
		if (freedTokens >= tokensToFree) break;
		freedTokens += part.tokens;
		toCompact.push(part);
	}

	debugLog(
		`[compaction] Found ${toCompact.length} parts to compact (oldest first), saving ~${freedTokens} tokens`,
	);

	if (toCompact.length > 0) {
		const compactedAt = Date.now();

		for (const part of toCompact) {
			try {
				await db
					.update(messageParts)
					.set({ compactedAt })
					.where(eq(messageParts.id, part.id));
			} catch (err) {
				debugLog(
					`[compaction] Failed to mark part ${part.id}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		debugLog(`[compaction] Marked ${toCompact.length} parts as compacted`);
	}

	return { compacted: toCompact.length, saved: freedTokens };
}
