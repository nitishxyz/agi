import type { getDb } from '@agi-cli/database';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { streamText } from 'ai';
import { resolveModel } from '../provider/index.ts';
import { getAuth } from '@agi-cli/sdk';
import { getProviderSpoofPrompt } from '../prompt/builder.ts';
import { loadConfig } from '@agi-cli/sdk';
import { debugLog } from '../debug/index.ts';
import { getModelLimits } from './compaction-limits.ts';
import { buildCompactionContext } from './compaction-context.ts';
import { getCompactionSystemPrompt } from './compaction-detect.ts';
import { markSessionCompacted } from './compaction-mark.ts';

export async function performAutoCompaction(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	assistantMessageId: string,
	publishFn: (event: {
		type: string;
		sessionId: string;
		payload: Record<string, unknown>;
	}) => void,
	provider: string,
	modelId: string,
): Promise<{
	success: boolean;
	summary?: string;
	error?: string;
	compactMessageId?: string;
}> {
	debugLog(`[compaction] Starting auto-compaction for session ${sessionId}`);

	try {
		const limits = getModelLimits(provider, modelId);
		const contextTokenLimit = limits
			? Math.max(Math.floor(limits.context * 0.5), 15000)
			: 15000;
		debugLog(
			`[compaction] Model ${modelId} context limit: ${limits?.context ?? 'unknown'}, using ${contextTokenLimit} tokens for compaction`,
		);

		const context = await buildCompactionContext(
			db,
			sessionId,
			contextTokenLimit,
		);
		if (!context || context.length < 100) {
			debugLog('[compaction] Not enough context to compact');
			return { success: false, error: 'Not enough context to compact' };
		}

		const cfg = await loadConfig();
		debugLog(
			`[compaction] Using session model ${provider}/${modelId} for auto-compaction`,
		);

		const auth = await getAuth(
			provider as
				| 'anthropic'
				| 'openai'
				| 'google'
				| 'openrouter'
				| 'opencode'
				| 'solforge'
				| 'zai'
				| 'zai-coding',
			cfg.projectRoot,
		);
		const needsSpoof = auth?.type === 'oauth';
		const spoofPrompt = needsSpoof
			? getProviderSpoofPrompt(provider as 'anthropic' | 'openai')
			: undefined;

		debugLog(
			`[compaction] OAuth mode: ${needsSpoof}, spoof: ${spoofPrompt ? 'yes' : 'no'}`,
		);

		const model = await resolveModel(
			provider as Parameters<typeof resolveModel>[0],
			modelId,
			cfg,
		);

		const compactionPrompt = getCompactionSystemPrompt();
		const systemPrompt = spoofPrompt ? spoofPrompt : compactionPrompt;
		const userInstructions = spoofPrompt
			? `${compactionPrompt}\n\nIMPORTANT: Generate a comprehensive summary. This will replace the detailed conversation history.`
			: 'IMPORTANT: Generate a comprehensive summary. This will replace the detailed conversation history.';

		const compactPartId = crypto.randomUUID();
		const now = Date.now();

		await db.insert(messageParts).values({
			id: compactPartId,
			messageId: assistantMessageId,
			index: 0,
			stepIndex: 0,
			type: 'text',
			content: JSON.stringify({ text: '' }),
			agent: 'system',
			provider: provider,
			model: modelId,
			startedAt: now,
		});

		const result = streamText({
		model,
		system: systemPrompt,
		messages: [
			{
				role: 'user',
				content: `${userInstructions}\n\nPlease summarize this conversation:\n\n<conversation-to-summarize>\n${context}\n</conversation-to-summarize>`,
			},
		],
		maxOutputTokens: 2000,
	});

		let summary = '';
		for await (const chunk of result.textStream) {
			summary += chunk;

			publishFn({
				type: 'message.part.delta',
				sessionId,
				payload: {
					messageId: assistantMessageId,
					partId: compactPartId,
					stepIndex: 0,
					type: 'text',
					delta: chunk,
				},
			});
		}

		await db
			.update(messageParts)
			.set({
				content: JSON.stringify({ text: summary }),
				completedAt: Date.now(),
			})
			.where(eq(messageParts.id, compactPartId));

		if (!summary || summary.length < 50) {
			debugLog('[compaction] Failed to generate summary');
			return { success: false, error: 'Failed to generate summary' };
		}

		debugLog(`[compaction] Generated summary: ${summary.slice(0, 100)}...`);

		const compactResult = await markSessionCompacted(
			db,
			sessionId,
			assistantMessageId,
		);
		debugLog(
			`[compaction] Marked ${compactResult.compacted} parts as compacted, saved ~${compactResult.saved} tokens`,
		);

		return { success: true, summary, compactMessageId: assistantMessageId };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		debugLog(`[compaction] Auto-compaction failed: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}
}
