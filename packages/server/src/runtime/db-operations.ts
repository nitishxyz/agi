import type { getDb } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import type { RunOpts } from './session-queue.ts';

export type UsageData = {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cachedInputTokens?: number;
	reasoningTokens?: number;
};

export type ProviderMetadata = Record<string, unknown> & {
	openai?: {
		cachedPromptTokens?: number;
		[key: string]: unknown;
	};
};

/**
 * Updates session token counts incrementally after each step.
 * Note: onStepFinish.usage is CUMULATIVE per message, so we compute DELTA and add to session.
 */
export async function updateSessionTokensIncremental(
	usage: UsageData,
	providerMetadata: ProviderMetadata | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage || !db) return;

	// Read session totals
	const sessRows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, opts.sessionId));

	if (sessRows.length === 0 || !sessRows[0]) return;

	const sess = sessRows[0];
	const priorInputSess = Number(sess.totalInputTokens ?? 0);
	const priorOutputSess = Number(sess.totalOutputTokens ?? 0);
	const priorCachedSess = Number(sess.totalCachedTokens ?? 0);
	const priorReasoningSess = Number(sess.totalReasoningTokens ?? 0);

	// Read current message totals to compute delta
	const msgRows = await db
		.select()
		.from(messages)
		.where(eq(messages.id, opts.assistantMessageId));

	const msg = msgRows[0];
	const priorPromptMsg = Number(msg?.promptTokens ?? 0);
	const priorCompletionMsg = Number(msg?.completionTokens ?? 0);
	const priorCachedMsg = Number(msg?.cachedInputTokens ?? 0);
	const priorReasoningMsg = Number(msg?.reasoningTokens ?? 0);

	// Treat usage as cumulative per-message for this step
	const cumPrompt =
		usage.inputTokens != null ? Number(usage.inputTokens) : priorPromptMsg;
	const cumCompletion =
		usage.outputTokens != null
			? Number(usage.outputTokens)
			: priorCompletionMsg;
	const cumReasoning =
		usage.reasoningTokens != null
			? Number(usage.reasoningTokens)
			: priorReasoningMsg;

	const cumCached =
		usage.cachedInputTokens != null
			? Number(usage.cachedInputTokens)
			: providerMetadata?.openai?.cachedPromptTokens != null
				? Number(providerMetadata.openai.cachedPromptTokens)
				: priorCachedMsg;

	// Compute deltas for this step; clamp to 0 in case provider reports smaller values
	// Cached tokens reduce the billable input, so we subtract them from the delta
	const deltaInput = Math.max(0, cumPrompt - priorPromptMsg);
	const deltaOutput = Math.max(0, cumCompletion - priorCompletionMsg);
	const deltaCached = Math.max(0, cumCached - priorCachedMsg);
	const deltaReasoning = Math.max(0, cumReasoning - priorReasoningMsg);

	// Session input should only count non-cached tokens
	// Total cached tokens are tracked separately for reference
	const nextInputSess = priorInputSess + deltaInput - deltaCached;
	const nextOutputSess = priorOutputSess + deltaOutput;
	const nextCachedSess = priorCachedSess + deltaCached;
	const nextReasoningSess = priorReasoningSess + deltaReasoning;

	await db
		.update(sessions)
		.set({
			totalInputTokens: nextInputSess,
			totalOutputTokens: nextOutputSess,
			totalCachedTokens: nextCachedSess,
			totalReasoningTokens: nextReasoningSess,
		})
		.where(eq(sessions.id, opts.sessionId));
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
	if (!fin.usage || !db) return;

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
 * Note: onStepFinish.usage is CUMULATIVE per message, so we REPLACE values, not add.
 */
export async function updateMessageTokensIncremental(
	usage: UsageData,
	providerMetadata: ProviderMetadata | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage || !db) return;

	const msgRows = await db
		.select()
		.from(messages)
		.where(eq(messages.id, opts.assistantMessageId));

	if (msgRows.length > 0 && msgRows[0]) {
		const msg = msgRows[0];
		const priorPrompt = Number(msg.promptTokens ?? 0);
		const priorCompletion = Number(msg.completionTokens ?? 0);
		const priorCached = Number(msg.cachedInputTokens ?? 0);
		const priorReasoning = Number(msg.reasoningTokens ?? 0);

		// Treat usage as cumulative per-message - REPLACE not ADD
		const cumPrompt =
			usage.inputTokens != null ? Number(usage.inputTokens) : priorPrompt;
		const cumCompletion =
			usage.outputTokens != null ? Number(usage.outputTokens) : priorCompletion;
		const cumReasoning =
			usage.reasoningTokens != null
				? Number(usage.reasoningTokens)
				: priorReasoning;

		const cumCached =
			usage.cachedInputTokens != null
				? Number(usage.cachedInputTokens)
				: providerMetadata?.openai?.cachedPromptTokens != null
					? Number(providerMetadata.openai.cachedPromptTokens)
					: priorCached;

		const cumTotal =
			usage.totalTokens != null
				? Number(usage.totalTokens)
				: cumPrompt + cumCompletion + cumReasoning;

		await db
			.update(messages)
			.set({
				promptTokens: cumPrompt,
				completionTokens: cumCompletion,
				totalTokens: cumTotal,
				cachedInputTokens: cumCached,
				reasoningTokens: cumReasoning,
			})
			.where(eq(messages.id, opts.assistantMessageId));
	}
}

/**
 * Marks an assistant message as complete.
 * Token usage is tracked incrementally via updateMessageTokensIncremental().
 */
export async function completeAssistantMessage(
	_fin: {
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
	},
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!db) return;

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
	if (!db) return;

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
