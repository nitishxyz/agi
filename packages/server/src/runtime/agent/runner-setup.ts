import { loadConfig, getUnderlyingProviderKey } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { resolveModel } from '../provider/index.ts';
import { resolveAgentConfig } from './registry.ts';
import {
	composeSystemPrompt,
	getProviderSpoofPrompt,
} from '../prompt/builder.ts';
import { discoverProjectTools } from '@agi-cli/sdk';
import { adaptTools } from '../../tools/adapter.ts';
import { buildDatabaseTools } from '../../tools/database/index.ts';
import { debugLog, time } from '../debug/index.ts';
import { buildHistoryMessages } from '../message/history-builder.ts';
import { getMaxOutputTokens } from '../utils/token.ts';
import { setupToolContext } from '../tools/setup.ts';
import { getCompactionSystemPrompt } from '../message/compaction.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';

export interface SetupResult {
	cfg: Awaited<ReturnType<typeof loadConfig>>;
	db: Awaited<ReturnType<typeof getDb>>;
	agentCfg: Awaited<ReturnType<typeof resolveAgentConfig>>;
	history: Awaited<ReturnType<typeof buildHistoryMessages>>;
	system: string;
	systemComponents: string[];
	additionalSystemMessages: Array<{ role: 'system' | 'user'; content: string }>;
	model: Awaited<ReturnType<typeof resolveModel>>;
	maxOutputTokens: number | undefined;
	effectiveMaxOutputTokens: number | undefined;
	toolset: ReturnType<typeof adaptTools>;
	sharedCtx: ToolAdapterContext;
	firstToolTimer: ReturnType<typeof time>;
	firstToolSeen: () => boolean;
	providerOptions: Record<string, unknown>;
	needsSpoof: boolean;
}

const THINKING_BUDGET = 16000;

export async function setupRunner(opts: RunOpts): Promise<SetupResult> {
	const cfgTimer = time('runner:loadConfig+db');
	const cfg = await loadConfig(opts.projectRoot);
	const db = await getDb(cfg.projectRoot);
	cfgTimer.end();

	const agentTimer = time('runner:resolveAgentConfig');
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, opts.agent);
	agentTimer.end({ agent: opts.agent });

	const agentPrompt = agentCfg.prompt || '';

	const historyTimer = time('runner:buildHistory');
	let history: Awaited<ReturnType<typeof buildHistoryMessages>>;
	if (opts.isCompactCommand && opts.compactionContext) {
		debugLog('[RUNNER] Using minimal history for /compact command');
		history = [];
	} else {
		history = await buildHistoryMessages(db, opts.sessionId);
	}
	historyTimer.end({ messages: history.length });

	const sessionRows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, opts.sessionId))
		.limit(1);
	const contextSummary = sessionRows[0]?.contextSummary ?? undefined;
	if (contextSummary) {
		debugLog(
			`[RUNNER] Using context summary from compaction (${contextSummary.length} chars)`,
		);
	}

	const isFirstMessage = !history.some((m) => m.role === 'assistant');

	debugLog(`[RUNNER] isFirstMessage: ${isFirstMessage}`);
	debugLog(`[RUNNER] userContext provided: ${opts.userContext ? 'YES' : 'NO'}`);
	if (opts.userContext) {
		debugLog(
			`[RUNNER] userContext value: ${opts.userContext.substring(0, 100)}${opts.userContext.length > 100 ? '...' : ''}`,
		);
	}

	const systemTimer = time('runner:composeSystemPrompt');
	const { getAuth } = await import('@agi-cli/sdk');
	const auth = await getAuth(opts.provider, cfg.projectRoot);
	const needsSpoof = auth?.type === 'oauth';
	const spoofPrompt = needsSpoof
		? getProviderSpoofPrompt(opts.provider)
		: undefined;

	debugLog(`[RUNNER] needsSpoof (OAuth): ${needsSpoof}`);
	debugLog(
		`[RUNNER] spoofPrompt: ${spoofPrompt ? `present (${opts.provider})` : 'none'}`,
	);

	let system: string;
	let systemComponents: string[] = [];
	let oauthFullPromptComponents: string[] | undefined;
	let additionalSystemMessages: Array<{
		role: 'system' | 'user';
		content: string;
	}> = [];

	if (spoofPrompt) {
		system = spoofPrompt;
		systemComponents = [`spoof:${opts.provider || 'unknown'}`];
		const fullPrompt = await composeSystemPrompt({
			provider: opts.provider,
			model: opts.model,
			projectRoot: cfg.projectRoot,
			agentPrompt,
			oneShot: opts.oneShot,
			spoofPrompt: undefined,
			includeProjectTree: isFirstMessage,
			userContext: opts.userContext,
			contextSummary,
		});
		oauthFullPromptComponents = fullPrompt.components;

		additionalSystemMessages = [{ role: 'system', content: fullPrompt.prompt }];

		debugLog('[RUNNER] OAuth mode: additionalSystemMessages created');
		const includesUserContext =
			!!opts.userContext && fullPrompt.prompt.includes(opts.userContext);
		debugLog(
			`[system] oauth-full summary: ${JSON.stringify({
				components: oauthFullPromptComponents ?? [],
				length: fullPrompt.prompt.length,
				includesUserContext,
			})}`,
		);
	} else {
		const composed = await composeSystemPrompt({
			provider: opts.provider,
			model: opts.model,
			projectRoot: cfg.projectRoot,
			agentPrompt,
			oneShot: opts.oneShot,
			spoofPrompt: undefined,
			includeProjectTree: isFirstMessage,
			userContext: opts.userContext,
			contextSummary,
		});
		system = composed.prompt;
		systemComponents = composed.components;
	}
	systemTimer.end();
	debugLog(
		`[system] summary: ${JSON.stringify({
			components: systemComponents,
			length: system.length,
		})}`,
	);

	if (opts.isCompactCommand && opts.compactionContext) {
		debugLog('[RUNNER] Injecting compaction context for /compact command');
		const compactPrompt = getCompactionSystemPrompt();
		additionalSystemMessages.push({
			role: 'system',
			content: compactPrompt,
		});
		additionalSystemMessages.push({
			role: 'user',
			content: `Please summarize this conversation:\n\n<conversation-to-summarize>\n${opts.compactionContext}\n</conversation-to-summarize>`,
		});
	}

	const toolsTimer = time('runner:discoverTools');
	const allTools = await discoverProjectTools(cfg.projectRoot);

	if (opts.agent === 'research') {
		// Get parent session ID for research sessions
		const currentSession = sessionRows[0];
		const parentSessionId = currentSession?.parentSessionId ?? null;

		const dbTools = buildDatabaseTools(cfg.projectRoot, parentSessionId);
		for (const dt of dbTools) {
			allTools.push(dt);
		}
		debugLog(
			`[tools] Added ${dbTools.length} database tools for research agent (parent: ${parentSessionId ?? 'none'})`,
		);
	}

	toolsTimer.end({ count: allTools.length });
	const allowedNames = new Set([...(agentCfg.tools || []), 'finish']);
	const gated = allTools.filter((tool) => allowedNames.has(tool.name));
	debugLog(`[tools] ${gated.length} allowed tools`);

	debugLog(`[RUNNER] About to create model with provider: ${opts.provider}`);
	debugLog(`[RUNNER] About to create model ID: ${opts.model}`);

	const oauthSystemPrompt =
		needsSpoof && opts.provider === 'openai' && additionalSystemMessages[0]
			? additionalSystemMessages[0].content
			: undefined;
	const model = await resolveModel(opts.provider, opts.model, cfg, {
		systemPrompt: oauthSystemPrompt,
		sessionId: opts.sessionId,
	});
	debugLog(
		`[RUNNER] Model created: ${JSON.stringify({ id: model.modelId, provider: model.provider })}`,
	);

	const maxOutputTokens = getMaxOutputTokens(opts.provider, opts.model);
	debugLog(`[RUNNER] maxOutputTokens for ${opts.model}: ${maxOutputTokens}`);

	const { sharedCtx, firstToolTimer, firstToolSeen } = await setupToolContext(
		opts,
		db,
	);

	const providerAuth = await getAuth(opts.provider, opts.projectRoot);
	const authType = providerAuth?.type;
	const toolset = adaptTools(gated, sharedCtx, opts.provider, authType);

	const providerOptions: Record<string, unknown> = {};
	let effectiveMaxOutputTokens = maxOutputTokens;

	if (opts.reasoningText) {
		const underlyingProvider = getUnderlyingProviderKey(
			opts.provider,
			opts.model,
		);

		if (underlyingProvider === 'anthropic') {
			providerOptions.anthropic = {
				thinking: { type: 'enabled', budgetTokens: THINKING_BUDGET },
			};
			if (maxOutputTokens && maxOutputTokens > THINKING_BUDGET) {
				effectiveMaxOutputTokens = maxOutputTokens - THINKING_BUDGET;
			}
		} else if (underlyingProvider === 'openai') {
			providerOptions.openai = {
				reasoningSummary: 'auto',
			};
		} else if (underlyingProvider === 'google') {
			providerOptions.google = {
				thinkingConfig: { thinkingBudget: THINKING_BUDGET },
			};
		} else if (underlyingProvider === 'openai-compatible') {
			providerOptions['openaiCompatible'] = {
				reasoningEffort: 'high',
			};
		}
	}

	return {
		cfg,
		db,
		agentCfg,
		history,
		system,
		systemComponents,
		additionalSystemMessages,
		model,
		maxOutputTokens,
		effectiveMaxOutputTokens,
		toolset,
		sharedCtx,
		firstToolTimer,
		firstToolSeen,
		providerOptions,
		needsSpoof,
	};
}

export function buildMessages(
	additionalSystemMessages: Array<{ role: string; content: string }>,
	history: Array<{ role: string; content: string | Array<unknown> }>,
	isFirstMessage: boolean,
): Array<{ role: string; content: string | Array<unknown> }> {
	const messagesWithSystemInstructions: Array<{
		role: string;
		content: string | Array<unknown>;
	}> = [...additionalSystemMessages, ...history];

	if (!isFirstMessage) {
		messagesWithSystemInstructions.push({
			role: 'user',
			content:
				'SYSTEM REMINDER: You are continuing an existing session. When you have completed the task, you MUST stream a text summary of what you did to the user, and THEN call the `finish` tool. Do not call `finish` without a summary.',
		});
	}

	return messagesWithSystemInstructions;
}
