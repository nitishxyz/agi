import type { getDb } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import type { RunOpts } from './session-queue.ts';

type UsageData = {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cachedInputTokens?: number;
	reasoningTokens?: number;
};

/**
 * Updates session token counts incrementally after each step.
 */
export async function updateSessionTokensIncremental(
	usage: UsageData,
	providerMetadata: Record<string, any> | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage) return;

	const sessRows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, opts.sessionId));

	if (sessRows.length > 0 && sessRows[0]) {
		const row = sessRows[0];
		const priorInput = Number(row.totalInputTokens ?? 0);
		const priorOutput = Number(row.totalOutputTokens ?? 0);
		const priorCached = Number(row.totalCachedTokens ?? 0);
		const priorReasoning = Number(row.totalReasoningTokens ?? 0);

		const nextInput = priorInput + Number(usage.inputTokens ?? 0);
		const nextOutput = priorOutput + Number(usage.outputTokens ?? 0);

		// Prefer normalized usage field over provider metadata
		const cachedTokens =
			usage.cachedInputTokens ??
			providerMetadata?.openai?.cachedPromptTokens ??
			0;
		const nextCached = priorCached + Number(cachedTokens);

		const nextReasoning = priorReasoning + Number(usage.reasoningTokens ?? 0);

		await db
			.update(sessions)
			.set({
				totalInputTokens: nextInput,
				totalOutputTokens: nextOutput,
				totalCachedTokens: nextCached,
				totalReasoningTokens: nextReasoning,
			})
			.where(eq(sessions.id, opts.sessionId));
	}
}

/**
 * Updates session token counts after a run completes.
 * @deprecated Use updateSessionTokensIncremental for per-step tracking
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
 * Updates message token counts incrementally after each step.
 */
export async function updateMessageTokensIncremental(
	usage: UsageData,
	providerMetadata: Record<string, any> | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage) return;

	const msgRows = await db
		.select()
		.from(messages)
		.where(eq(messages.id, opts.assistantMessageId));

	if (msgRows.length > 0 && msgRows[0]) {
		const msg = msgRows[0];
		const priorPrompt = Number(msg.promptTokens ?? 0);
		const priorCompletion = Number(msg.completionTokens ?? 0);
		const priorTotal = Number(msg.totalTokens ?? 0);
		const priorCached = Number(msg.cachedInputTokens ?? 0);
		const priorReasoning = Number(msg.reasoningTokens ?? 0);

		const nextPrompt = priorPrompt + Number(usage.inputTokens ?? 0);
		const nextCompletion = priorCompletion + Number(usage.outputTokens ?? 0);

		// Prefer normalized usage field over provider metadata
		const cachedTokens =
			usage.cachedInputTokens ??
			providerMetadata?.openai?.cachedPromptTokens ??
			0;
		const nextCached = priorCached + Number(cachedTokens);

		const nextReasoning = priorReasoning + Number(usage.reasoningTokens ?? 0);

		// Accumulate total tokens from this step
		const stepTotal =
			usage.totalTokens ??
			(usage.inputTokens ?? 0) +
				(usage.outputTokens ?? 0) +
				(usage.reasoningTokens ?? 0);
		const nextTotal = priorTotal + stepTotal;

		await db
			.update(messages)
			.set({
				promptTokens: nextPrompt,
				completionTokens: nextCompletion,
				totalTokens: nextTotal,
				cachedInputTokens: nextCached,
				reasoningTokens: nextReasoning,
			})
			.where(eq(messages.id, opts.assistantMessageId));
	}
}

/**
 * Marks an assistant message as complete.
 * Token usage is tracked incrementally via updateMessageTokensIncremental().
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
	// Only mark as complete - tokens are already tracked incrementally
	await db
		.update(messages)
		.set({
			status: 'complete',
			completedAt: Date.now(),
		})
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
