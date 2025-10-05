import type { getDb } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import type { RunOpts } from './session-queue.ts';

/**
 * Updates session token counts after a run completes.
 */
export async function updateSessionTokens(
	fin: { usage?: { inputTokens?: number; outputTokens?: number } },
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!fin.usage) return;

	const sessRows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, opts.sessionId));

	if (sessRows.length > 0 && sessRows[0]) {
		const row = sessRows[0];
		const priorInput = Number(row.totalInputTokens ?? 0);
		const priorOutput = Number(row.totalOutputTokens ?? 0);
		const nextInput = priorInput + Number(fin.usage.inputTokens ?? 0);
		const nextOutput = priorOutput + Number(fin.usage.outputTokens ?? 0);

		await db
			.update(sessions)
			.set({
				totalInputTokens: nextInput,
				totalOutputTokens: nextOutput,
			})
			.where(eq(sessions.id, opts.sessionId));
	}
}

/**
 * Marks an assistant message as complete with token usage information.
 */
export async function completeAssistantMessage(
	fin: {
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
	},
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	const vals: Record<string, unknown> = {
		status: 'complete',
		completedAt: Date.now(),
	};

	if (fin.usage) {
		vals.promptTokens = fin.usage.inputTokens;
		vals.completionTokens = fin.usage.outputTokens;
		vals.totalTokens =
			fin.usage.totalTokens ??
			(vals.promptTokens as number) + (vals.completionTokens as number);
	}

	await db
		.update(messages)
		.set(vals)
		.where(eq(messages.id, opts.assistantMessageId));
}

/**
 * Removes empty text parts from an assistant message.
 */
export async function cleanupEmptyTextParts(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	const parts = await db
		.select()
		.from(messageParts)
		.where(eq(messageParts.messageId, opts.assistantMessageId));

	for (const p of parts) {
		if (p.type === 'text') {
			let t = '';
			try {
				t = JSON.parse(p.content || '{}')?.text || '';
			} catch {}
			if (!t || t.length === 0) {
				await db.delete(messageParts).where(eq(messageParts.id, p.id));
			}
		}
	}
}
