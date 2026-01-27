import type { getDb } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { catalog, type ProviderId } from '@agi-cli/sdk';
import type { RunOpts } from './queue.ts';

export type UsageData = {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cachedInputTokens?: number;
	cacheCreationInputTokens?: number;
	reasoningTokens?: number;
};

export type ProviderMetadata = Record<string, unknown> & {
	openai?: {
		cachedPromptTokens?: number;
		[key: string]: unknown;
	};
	anthropic?: {
		cacheCreationInputTokens?: number;
		cacheReadInputTokens?: number;
		[key: string]: unknown;
	};
};

export function normalizeUsage(
	usage: UsageData,
	providerOptions: ProviderMetadata | undefined,
	provider: ProviderId,
): UsageData {
	const rawInputTokens = Number(usage.inputTokens ?? 0);
	const outputTokens = Number(usage.outputTokens ?? 0);
	const reasoningTokens = Number(usage.reasoningTokens ?? 0);

	const cachedInputTokens =
		usage.cachedInputTokens != null
			? Number(usage.cachedInputTokens)
			: providerOptions?.openai?.cachedPromptTokens != null
				? Number(providerOptions.openai.cachedPromptTokens)
				: providerOptions?.anthropic?.cacheReadInputTokens != null
					? Number(providerOptions.anthropic.cacheReadInputTokens)
					: undefined;

	const cacheCreationInputTokens =
		usage.cacheCreationInputTokens != null
			? Number(usage.cacheCreationInputTokens)
			: providerOptions?.anthropic?.cacheCreationInputTokens != null
				? Number(providerOptions.anthropic.cacheCreationInputTokens)
				: undefined;

	const cachedValue = cachedInputTokens ?? 0;
	const cacheCreationValue = cacheCreationInputTokens ?? 0;

	let inputTokens = rawInputTokens;
	if (provider === 'openai') {
		inputTokens = Math.max(0, rawInputTokens - cachedValue);
	} else if (provider === 'anthropic') {
		inputTokens = Math.max(0, rawInputTokens - cacheCreationValue);
	}

	return {
		inputTokens,
		outputTokens,
		cachedInputTokens,
		cacheCreationInputTokens,
		reasoningTokens,
	};
}

export function resolveUsageProvider(
	provider: ProviderId,
	model: string,
): ProviderId {
	if (
		provider !== 'setu' &&
		provider !== 'openrouter' &&
		provider !== 'opencode'
	) {
		return provider;
	}
	const entry = catalog[provider];
	const normalizedModel = model.includes('/') ? model.split('/').at(-1) : model;
	const modelEntry = entry?.models.find(
		(m) => m.id?.toLowerCase() === normalizedModel?.toLowerCase(),
	);
	const npm = modelEntry?.provider?.npm ?? '';
	if (npm.includes('openai')) return 'openai';
	if (npm.includes('anthropic')) return 'anthropic';
	if (npm.includes('google')) return 'google';
	if (npm.includes('zai')) return 'zai';
	return provider;
}

/**
 * Updates session token counts incrementally after each step.
 * Note: onStepFinish.usage is CUMULATIVE per message, so we compute DELTA and add to session.
 */
export async function updateSessionTokensIncremental(
	usage: UsageData,
	providerOptions: ProviderMetadata | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage || !db) return;

	const usageProvider = resolveUsageProvider(opts.provider, opts.model);
	const normalizedUsage = normalizeUsage(usage, providerOptions, usageProvider);

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
	const priorCacheCreationSess = Number(sess.totalCacheCreationTokens ?? 0);
	const priorReasoningSess = Number(sess.totalReasoningTokens ?? 0);

	// Read current message totals to compute delta
	const msgRows = await db
		.select()
		.from(messages)
		.where(eq(messages.id, opts.assistantMessageId));

	const msg = msgRows[0];
	const priorPromptMsg = Number(msg?.inputTokens ?? 0);
	const priorCompletionMsg = Number(msg?.outputTokens ?? 0);
	const priorCachedMsg = Number(msg?.cachedInputTokens ?? 0);
	const priorCacheCreationMsg = Number(msg?.cacheCreationInputTokens ?? 0);
	const priorReasoningMsg = Number(msg?.reasoningTokens ?? 0);

	// Treat usage as cumulative per-message for this step
	const cumPrompt =
		normalizedUsage.inputTokens != null
			? Number(normalizedUsage.inputTokens)
			: priorPromptMsg;
	const cumCompletion =
		normalizedUsage.outputTokens != null
			? Number(normalizedUsage.outputTokens)
			: priorCompletionMsg;
	const cumReasoning =
		normalizedUsage.reasoningTokens != null
			? Number(normalizedUsage.reasoningTokens)
			: priorReasoningMsg;

	const cumCached =
		normalizedUsage.cachedInputTokens != null
			? Number(normalizedUsage.cachedInputTokens)
			: priorCachedMsg;

	const cumCacheCreation =
		normalizedUsage.cacheCreationInputTokens != null
			? Number(normalizedUsage.cacheCreationInputTokens)
			: priorCacheCreationMsg;

	// Compute deltas for this step; clamp to 0 in case provider reports smaller values
	const deltaInput = Math.max(0, cumPrompt - priorPromptMsg);
	const deltaOutput = Math.max(0, cumCompletion - priorCompletionMsg);
	const deltaCached = Math.max(0, cumCached - priorCachedMsg);
	const deltaCacheCreation = Math.max(
		0,
		cumCacheCreation - priorCacheCreationMsg,
	);
	const deltaReasoning = Math.max(0, cumReasoning - priorReasoningMsg);

	const nextInputSess = priorInputSess + deltaInput;
	const nextOutputSess = priorOutputSess + deltaOutput;
	const nextCachedSess = priorCachedSess + deltaCached;
	const nextCacheCreationSess = priorCacheCreationSess + deltaCacheCreation;
	const nextReasoningSess = priorReasoningSess + deltaReasoning;

	await db
		.update(sessions)
		.set({
			totalInputTokens: nextInputSess,
			totalOutputTokens: nextOutputSess,
			totalCachedTokens: nextCachedSess,
			totalCacheCreationTokens: nextCacheCreationSess,
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
	providerOptions: ProviderMetadata | undefined,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	if (!usage || !db) return;

	const usageProvider = resolveUsageProvider(opts.provider, opts.model);
	const normalizedUsage = normalizeUsage(usage, providerOptions, usageProvider);

	const msgRows = await db
		.select()
		.from(messages)
		.where(eq(messages.id, opts.assistantMessageId));

	if (msgRows.length > 0 && msgRows[0]) {
		const msg = msgRows[0];
		const priorPrompt = Number(msg.inputTokens ?? 0);
		const priorCompletion = Number(msg.outputTokens ?? 0);
		const priorCached = Number(msg.cachedInputTokens ?? 0);
		const priorCacheCreation = Number(msg.cacheCreationInputTokens ?? 0);
		const priorReasoning = Number(msg.reasoningTokens ?? 0);

		// Treat usage as cumulative per-message - REPLACE not ADD
		const cumPrompt =
			normalizedUsage.inputTokens != null
				? Number(normalizedUsage.inputTokens)
				: priorPrompt;
		const cumCompletion =
			normalizedUsage.outputTokens != null
				? Number(normalizedUsage.outputTokens)
				: priorCompletion;
		const cumReasoning =
			normalizedUsage.reasoningTokens != null
				? Number(normalizedUsage.reasoningTokens)
				: priorReasoning;

		const cumCached =
			normalizedUsage.cachedInputTokens != null
				? Number(normalizedUsage.cachedInputTokens)
				: priorCached;

		const cumCacheCreation =
			normalizedUsage.cacheCreationInputTokens != null
				? Number(normalizedUsage.cacheCreationInputTokens)
				: priorCacheCreation;

		const cumTotal =
			cumPrompt + cumCompletion + cumCached + cumCacheCreation + cumReasoning;

		await db
			.update(messages)
			.set({
				inputTokens: cumPrompt,
				outputTokens: cumCompletion,
				totalTokens: cumTotal,
				cachedInputTokens: cumCached,
				cacheCreationInputTokens: cumCacheCreation,
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
