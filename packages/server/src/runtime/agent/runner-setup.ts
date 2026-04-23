import {
	loadConfig,
	logger,
	getConfiguredProviderFamily,
	getSessionSystemPromptPath,
	getModelFamily,
	type OttoConfig,
} from '@ottocode/sdk';
import { wrapLanguageModel } from 'ai';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { getDb } from '@ottocode/database';
import { sessions } from '@ottocode/database/schema';
import { eq } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveModel } from '../provider/index.ts';
import { resolveAgentConfig } from './registry.ts';
import { composeSystemPrompt } from '../prompt/builder.ts';
import { discoverProjectTools } from '@ottocode/sdk';
import type { Tool } from 'ai';
import { adaptTools } from '../../tools/adapter.ts';
import { buildDatabaseTools } from '../../tools/database/index.ts';
import { time } from '../debug/index.ts';
import { isDebugEnabled, isDevtoolsEnabled } from '../debug/state.ts';
import { buildHistoryMessages } from '../message/history-builder.ts';
import { getMaxOutputTokens } from '../utils/token.ts';
import { setupToolContext } from '../tools/setup.ts';
import { getCompactionSystemPrompt } from '../message/compaction.ts';
import { detectOAuth, adaptRunnerCall } from '../provider/oauth-adapter.ts';
import { buildReasoningConfig } from '../provider/reasoning.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';

type RunnerSetupTimings = {
	loadConfigAndDbMs: number;
	resolveAgentConfigMs: number;
	buildHistoryMs: number;
	loadSessionMs: number;
	composeSystemPromptMs: number;
	discoverToolsMs: number;
	resolveModelMs: number;
	setupToolContextMs: number;
	buildToolsetMs: number;
	totalMs: number;
};

type TimedResult<T> = {
	value: T;
	durationMs: number;
};

function nowMs(): number {
	const perf = globalThis.performance;
	if (perf && typeof perf.now === 'function') return perf.now();
	return Date.now();
}

async function timePromise<T>(promise: Promise<T>): Promise<TimedResult<T>> {
	const startedAt = nowMs();
	const value = await promise;
	return {
		value,
		durationMs: nowMs() - startedAt,
	};
}

export interface SetupResult {
	cfg: Awaited<ReturnType<typeof loadConfig>>;
	db: Awaited<ReturnType<typeof getDb>>;
	agentCfg: Awaited<ReturnType<typeof resolveAgentConfig>>;
	history: Awaited<ReturnType<typeof buildHistoryMessages>>;
	system: string;
	systemComponents: string[];
	additionalSystemMessages: Array<{ role: 'system' | 'user'; content: string }>;
	model:
		| Awaited<ReturnType<typeof resolveModel>>
		| ReturnType<typeof wrapLanguageModel>;
	maxOutputTokens: number | undefined;
	effectiveMaxOutputTokens: number | undefined;
	toolset: ReturnType<typeof adaptTools>;
	sharedCtx: ToolAdapterContext;
	firstToolTimer: ReturnType<typeof time>;
	firstToolSeen: () => boolean;
	providerOptions: Record<string, unknown>;
	needsSpoof: boolean;
	isOpenAIOAuth: boolean;
	mcpToolsRecord: Record<string, Tool>;
	timings: RunnerSetupTimings;
}

export function mergeProviderOptions(
	base: Record<string, unknown>,
	incoming: Record<string, unknown>,
): Record<string, unknown> {
	for (const [key, value] of Object.entries(incoming)) {
		const existing = base[key];
		if (
			existing &&
			typeof existing === 'object' &&
			!Array.isArray(existing) &&
			value &&
			typeof value === 'object' &&
			!Array.isArray(value)
		) {
			base[key] = {
				...(existing as Record<string, unknown>),
				...(value as Record<string, unknown>),
			};
			continue;
		}

		base[key] = value;
	}

	return base;
}

const EDITING_TOOL_NAMES = ['edit', 'multiedit', 'write', 'apply_patch'];
const MODEL_FAMILY_EDIT_TOOL_POLICY_AGENTS = new Set([
	'build',
	'general',
	'init',
]);

export function applyModelFamilyEditToolPolicy(
	agent: string,
	tools: string[],
	provider: RunOpts['provider'],
	model: string,
	cfg?: OttoConfig,
): string[] {
	if (!MODEL_FAMILY_EDIT_TOOL_POLICY_AGENTS.has(agent)) return tools;

	const family = cfg
		? getConfiguredProviderFamily(cfg, provider, model)
		: getModelFamily(provider, model);
	const next = tools.filter(
		(toolName) => !EDITING_TOOL_NAMES.includes(toolName),
	);
	const preferredEditingTools =
		family === 'anthropic' || family === 'openai'
			? ['write', 'apply_patch']
			: ['write', 'edit', 'multiedit'];

	return Array.from(new Set([...next, ...preferredEditingTools]));
}

export async function setupRunner(opts: RunOpts): Promise<SetupResult> {
	const setupStartedAt = nowMs();
	const cfgTimer = time('runner:loadConfig+db');
	const loadConfigAndDbStartedAt = nowMs();
	const cfg = await loadConfig(opts.projectRoot);
	const db = await getDb(cfg.projectRoot);
	const loadConfigAndDbMs = nowMs() - loadConfigAndDbStartedAt;
	cfgTimer.end();

	const agentTimer = time('runner:resolveAgentConfig');
	const agentCfgPromise = timePromise(
		resolveAgentConfig(cfg.projectRoot, opts.agent),
	);
	const historyPromise =
		opts.omitHistory || (opts.isCompactCommand && opts.compactionContext)
			? Promise.resolve({ value: [], durationMs: 0 })
			: timePromise(
					buildHistoryMessages(db, opts.sessionId, opts.assistantMessageId),
				);
	const sessionRowsPromise = timePromise(
		db.select().from(sessions).where(eq(sessions.id, opts.sessionId)).limit(1),
	);
	const discoveredToolsPromise = timePromise(
		discoverProjectTools(cfg.projectRoot, undefined, cfg.skills),
	);
	const { value: agentCfg, durationMs: resolveAgentConfigMs } =
		await agentCfgPromise;
	agentTimer.end({ agent: opts.agent });

	const agentPrompt = agentCfg.prompt || '';

	const historyTimer = time('runner:buildHistory');
	const { value: history, durationMs: buildHistoryMs } = await historyPromise;
	historyTimer.end({ messages: history.length });

	const { value: sessionRows, durationMs: loadSessionMs } =
		await sessionRowsPromise;
	const contextSummary = sessionRows[0]?.contextSummary ?? undefined;
	const toolsTimer = time('runner:discoverTools');
	const { value: discovered, durationMs: discoverToolsMs } =
		await discoveredToolsPromise;
	const allTools = discovered.tools;
	const { mcpToolsRecord } = discovered;

	if (opts.agent === 'research') {
		const currentSession = sessionRows[0];
		const parentSessionId = currentSession?.parentSessionId ?? null;

		const dbTools = buildDatabaseTools(cfg.projectRoot, parentSessionId);
		for (const dt of dbTools) {
			discovered.tools.push(dt);
		}
	}

	toolsTimer.end({
		count: allTools.length + Object.keys(mcpToolsRecord).length,
	});

	const isFirstMessage = !history.some((m) => m.role === 'assistant');

	const systemTimer = time('runner:composeSystemPrompt');
	const composeSystemPromptStartedAt = nowMs();
	const { getAuth } = await import('@ottocode/sdk');
	const auth = await getAuth(opts.provider, cfg.projectRoot);
	const oauth = detectOAuth(opts.provider, auth);

	const composed = await composeSystemPrompt({
		provider: opts.provider,
		model: opts.model,
		promptFamily: getConfiguredProviderFamily(cfg, opts.provider, opts.model),
		skillSettings: cfg.skills,
		projectRoot: cfg.projectRoot,
		agentPrompt,
		oneShot: opts.oneShot,
		guidedMode: cfg.defaults.guidedMode,
		spoofPrompt: undefined,
		includeProjectTree: false,
		userContext: opts.userContext,
		contextSummary,
		isOpenAIOAuth: oauth.isOpenAIOAuth,
	});

	const rawMaxOutputTokens = getMaxOutputTokens(opts.provider, opts.model);
	const adapted = adaptRunnerCall(oauth, composed, {
		provider: opts.provider,
		rawMaxOutputTokens,
	});

	const { system } = adapted;
	const { systemComponents, additionalSystemMessages } = adapted;
	const openAIProviderOptions = adapted.providerOptions.openai as
		| Record<string, unknown>
		| undefined;
	const openAIInstructions =
		typeof openAIProviderOptions?.instructions === 'string'
			? openAIProviderOptions.instructions
			: '';
	const effectiveSystemPrompt = system || openAIInstructions || composed.prompt;
	const promptMode = oauth.isOpenAIOAuth
		? 'openai-oauth'
		: oauth.needsSpoof
			? 'spoof'
			: 'standard';
	const composeSystemPromptMs = nowMs() - composeSystemPromptStartedAt;
	systemTimer.end();
	logger.debug('[prompt] system prompt assembled', {
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		promptMode,
		components: systemComponents,
		systemLength: effectiveSystemPrompt.length,
		historyMessages: history.length,
		additionalSystemMessages: additionalSystemMessages.length,
		isFirstMessage,
		isOpenAIOAuth: oauth.isOpenAIOAuth,
		needsSpoof: oauth.needsSpoof,
	});
	logger.debug('[prompt] detailed prompt context', {
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		debugDetail: true,
		agentPromptLength: agentPrompt.length,
		contextSummaryLength: contextSummary?.length ?? 0,
		userContextLength: opts.userContext?.length ?? 0,
		oneShot: Boolean(opts.oneShot),
		guidedMode: Boolean(cfg.defaults.guidedMode),
		isOpenAIOAuth: oauth.isOpenAIOAuth,
		needsSpoof: oauth.needsSpoof,
		promptMode,
		rawSystemLength: system.length,
		openAIInstructionsLength: openAIInstructions.length,
		effectiveSystemPromptLength: effectiveSystemPrompt.length,
		systemComponents,
		additionalSystemMessageRoles: additionalSystemMessages.map(
			(message) => message.role,
		),
	});
	if (effectiveSystemPrompt && isDebugEnabled()) {
		const systemPromptPath = getSessionSystemPromptPath(opts.sessionId);
		try {
			await mkdir(dirname(systemPromptPath), { recursive: true });
			await Bun.write(systemPromptPath, effectiveSystemPrompt);
			logger.debug('[prompt] wrote system prompt file', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				path: systemPromptPath,
				debugDetail: true,
				promptMode,
				effectiveSystemPromptLength: effectiveSystemPrompt.length,
			});
		} catch (error) {
			logger.warn('[prompt] failed to write system prompt file', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	if (opts.isCompactCommand && opts.compactionContext) {
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

	if (opts.additionalPromptMessages?.length) {
		additionalSystemMessages.push(...opts.additionalPromptMessages);
	}
	const allowedToolNames = applyModelFamilyEditToolPolicy(
		agentCfg.name,
		agentCfg.tools || [],
		opts.provider,
		opts.model,
	);
	const allowedNames = new Set([...allowedToolNames, 'finish']);
	const gated = allTools.filter(
		(tool) => allowedNames.has(tool.name) || tool.name === 'load_mcp_tools',
	);

	const resolveModelStartedAt = nowMs();
	const model = await resolveModel(opts.provider, opts.model, cfg, {
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		reasoningText: opts.reasoningText,
	});
	const resolveModelMs = nowMs() - resolveModelStartedAt;
	const wrappedModel = isDevtoolsEnabled()
		? wrapLanguageModel({
				// biome-ignore lint/suspicious/noExplicitAny: OpenRouter provider uses v2 spec
				model: model as any,
				middleware: devToolsMiddleware(),
			})
		: model;

	const maxOutputTokens = adapted.maxOutputTokens;

	const setupToolContextStartedAt = nowMs();
	const { sharedCtx, firstToolTimer, firstToolSeen } = await setupToolContext(
		opts,
		db,
	);
	const setupToolContextMs = nowMs() - setupToolContextStartedAt;

	const buildToolsetStartedAt = nowMs();
	const providerAuth = await getAuth(opts.provider, opts.projectRoot);
	const authType = providerAuth?.type;
	const toolset = adaptTools(gated, sharedCtx, opts.provider, authType);
	const buildToolsetMs = nowMs() - buildToolsetStartedAt;

	const providerOptions = { ...adapted.providerOptions };
	let effectiveMaxOutputTokens = maxOutputTokens;

	if (opts.provider === 'copilot') {
		providerOptions.openai = {
			...((providerOptions.openai as Record<string, unknown>) || {}),
			store: false,
		};
	}

	const reasoningConfig = buildReasoningConfig({
		cfg,
		provider: opts.provider,
		model: opts.model,
		reasoningText: opts.reasoningText,
		reasoningLevel: opts.reasoningLevel,
		maxOutputTokens,
	});
	mergeProviderOptions(providerOptions, reasoningConfig.providerOptions);
	effectiveMaxOutputTokens = reasoningConfig.effectiveMaxOutputTokens;

	const timings: RunnerSetupTimings = {
		loadConfigAndDbMs,
		resolveAgentConfigMs,
		buildHistoryMs,
		loadSessionMs,
		composeSystemPromptMs,
		discoverToolsMs,
		resolveModelMs,
		setupToolContextMs,
		buildToolsetMs,
		totalMs: nowMs() - setupStartedAt,
	};

	logger.info('[latency] runner setup', {
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		historyMessages: history.length,
		systemPromptChars: effectiveSystemPrompt.length,
		additionalPromptMessages: additionalSystemMessages.length,
		allowedToolCount: gated.length,
		timings,
	});

	return {
		cfg,
		db,
		agentCfg,
		history,
		system,
		systemComponents,
		additionalSystemMessages,
		model: wrappedModel,
		maxOutputTokens,
		effectiveMaxOutputTokens,
		toolset,
		sharedCtx,
		firstToolTimer,
		firstToolSeen,
		providerOptions,
		needsSpoof: oauth.needsSpoof,
		isOpenAIOAuth: oauth.isOpenAIOAuth,
		mcpToolsRecord,
		timings,
	};
}
