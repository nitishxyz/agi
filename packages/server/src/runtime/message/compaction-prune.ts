import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq, desc } from 'drizzle-orm';
import { debugLog } from '../debug/index.ts';
import { estimateTokens, PRUNE_PROTECT } from './compaction-limits.ts';

const PROTECTED_TOOLS = ['skill'];

export async function pruneSession(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
): Promise<{ pruned: number; saved: number }> {
	debugLog(`[compaction] Auto-pruning session ${sessionId}`);

	const allMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(desc(messages.createdAt));

	let totalTokens = 0;
	let prunedTokens = 0;
	const toPrune: Array<{ id: string }> = [];
	let turns = 0;

	for (const msg of allMessages) {
		if (msg.role === 'user') turns++;
		if (turns < 2) continue;

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(desc(messageParts.index));

		for (const part of parts) {
			if (part.type !== 'tool_result') continue;
			if (part.toolName && PROTECTED_TOOLS.includes(part.toolName)) continue;
			if (part.compactedAt) continue;

			let content: { result?: unknown };
			try {
				content = JSON.parse(part.content ?? '{}');
			} catch {
				continue;
			}

			const estimate = estimateTokens(
				typeof content.result === 'string'
					? content.result
					: JSON.stringify(content.result ?? ''),
			);
			totalTokens += estimate;

			if (totalTokens > PRUNE_PROTECT) {
				prunedTokens += estimate;
				toPrune.push({ id: part.id });
			}
		}
	}

	if (toPrune.length > 0) {
		const compactedAt = Date.now();
		for (const part of toPrune) {
			try {
				await db
					.update(messageParts)
					.set({ compactedAt })
					.where(eq(messageParts.id, part.id));
			} catch {}
		}
	}

	return { pruned: toPrune.length, saved: prunedTokens };
}
