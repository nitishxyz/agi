import { hasToolCall, streamText } from 'ai';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { resolveModel } from './provider.ts';
import { resolveAgentConfig } from './agent-registry.ts';
import { composeSystemPrompt } from './prompt.ts';
import { discoverProjectTools } from '@agi-cli/sdk';
import { adaptTools } from '../tools/adapter.ts';
import { publish, subscribe } from '../events/bus.ts';
import { debugLog, time } from './debug.ts';
import { buildHistoryMessages } from './history-builder.ts';
import { toErrorPayload } from './error-handling.ts';
import { getMaxOutputTokens } from './token-utils.ts';
import {
	type RunOpts,
	enqueueAssistantRun as enqueueRun,
	abortSession as abortSessionQueue,
	getRunnerState,
	setRunning,
	dequeueJob,
	cleanupSession,
} from './session-queue.ts';
import {
	setupToolContext,
	type RunnerToolContext,
} from './tool-context-setup.ts';
import {
	updateSessionTokensIncremental,
	updateMessageTokensIncremental,
	completeAssistantMessage,
	cleanupEmptyTextParts,
} from './db-operations.ts';
import {
	createStepFinishHandler,
	createErrorHandler,
	createAbortHandler,
	createFinishHandler,
} from './stream-handlers.ts';

/**
 * Enqueues an assistant run for processing.
 */
export function enqueueAssistantRun(opts: Omit<RunOpts, 'abortSignal'>) {
	enqueueRun(opts, processQueue);
}

/**
 * Aborts an active session.
 */
export function abortSession(sessionId: string) {
	abortSessionQueue(sessionId);
}

/**
 * Processes the queue of assistant runs for a session.
 */
async function processQueue(sessionId: string) {
	const state = getRunnerState(sessionId);
	if (!state) return;
	if (state.running) return;
	setRunning(sessionId, true);

	while (state.queue.length > 0) {
		const job = dequeueJob(sessionId);
		if (!job) break;
		try {
			await runAssistant(job);
		} catch (_err) {
			// Swallow to keep the loop alive; event published by runner
		}
	}

	setRunning(sessionId, false);
	cleanupSession(sessionId);
}

/**
 * Ensures the finish tool is called if not already observed.
 */
async function ensureFinishToolCalled(
	finishObserved: boolean,
	toolset: ReturnType<typeof adaptTools>,
	sharedCtx: RunnerToolContext,
	stepIndex: number,
) {
	if (finishObserved || !toolset?.finish?.execute) return;

	const finishInput = {} as const;
	const callOptions = { input: finishInput } as const;

	sharedCtx.stepIndex = stepIndex;

	try {
		await toolset.finish.onInputStart?.(callOptions as never);
	} catch {}

	try {
		await toolset.finish.onInputAvailable?.(callOptions as never);
	} catch {}

	await toolset.finish.execute(finishInput, {} as never);
}

/**
 * Main function to run the assistant for a given request.
 */
async function runAssistant(opts: RunOpts) {
	const cfgTimer = time('runner:loadConfig+db');
	const cfg = await loadConfig(opts.projectRoot);
	const db = await getDb(cfg.projectRoot);
	cfgTimer.end();

	const agentTimer = time('runner:resolveAgentConfig');
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, opts.agent);
	agentTimer.end({ agent: opts.agent });

	const agentPrompt = agentCfg.prompt || '';

	const historyTimer = time('runner:buildHistory');
	const history = await buildHistoryMessages(db, opts.sessionId);
	historyTimer.end({ messages: history.length });

	const isFirstMessage = history.length === 0;

	const systemTimer = time('runner:composeSystemPrompt');
	const { getAuth } = await import('@agi-cli/sdk');
	const { getProviderSpoofPrompt } = await import('./prompt.ts');
	const auth = await getAuth(opts.provider, cfg.projectRoot);
	const needsSpoof = auth?.type === 'oauth';
	const spoofPrompt = needsSpoof
		? getProviderSpoofPrompt(opts.provider)
		: undefined;

	let system: string;
	let additionalSystemMessages: Array<{ role: 'system'; content: string }> = [];

	if (spoofPrompt) {
		system = spoofPrompt;
		const fullPrompt = await composeSystemPrompt({
			provider: opts.provider,
			model: opts.model,
			projectRoot: cfg.projectRoot,
			agentPrompt,
			oneShot: opts.oneShot,
			spoofPrompt: undefined,
			includeProjectTree: isFirstMessage,
			userContext: opts.userContext,
		});
		additionalSystemMessages = [{ role: 'system', content: fullPrompt }];
	} else {
		system = await composeSystemPrompt({
			provider: opts.provider,
			model: opts.model,
			projectRoot: cfg.projectRoot,
			agentPrompt,
			oneShot: opts.oneShot,
			spoofPrompt: undefined,
			includeProjectTree: isFirstMessage,
			userContext: opts.userContext,
		});
	}
	systemTimer.end();
	debugLog('[system] composed prompt (provider+base+agent):');
	debugLog(system);

	const toolsTimer = time('runner:discoverTools');
	const allTools = await discoverProjectTools(cfg.projectRoot);
	toolsTimer.end({ count: allTools.length });
	const allowedNames = new Set([
		...(agentCfg.tools || []),
		'finish',
		'progress_update',
	]);
	const gated = allTools.filter((t) => allowedNames.has(t.name));
	const messagesWithSystemInstructions = [
		...(isFirstMessage ? additionalSystemMessages : []),
		...history,
	];

	const { sharedCtx, firstToolTimer, firstToolSeen } = await setupToolContext(
		opts,
		db,
	);
	const toolset = adaptTools(gated, sharedCtx, opts.provider);

	const modelTimer = time('runner:resolveModel');
	const model = await resolveModel(opts.provider, opts.model, cfg);
	modelTimer.end();

	const maxOutputTokens = getMaxOutputTokens(opts.provider, opts.model);

	let currentPartId = opts.assistantPartId;
	let accumulated = '';
	let stepIndex = 0;

	let finishObserved = false;
	const unsubscribeFinish = subscribe(opts.sessionId, (evt) => {
		if (evt.type !== 'tool.result') return;
		try {
			const name = (evt.payload as { name?: string } | undefined)?.name;
			if (name === 'finish') finishObserved = true;
		} catch {}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;
	debugLog(`[streamText] Calling with maxOutputTokens: ${maxOutputTokens}`);

	// State management helpers
	const getCurrentPartId = () => currentPartId;
	const getStepIndex = () => stepIndex;
	const updateCurrentPartId = (id: string) => {
		currentPartId = id;
	};
	const updateAccumulated = (text: string) => {
		accumulated = text;
	};
	const incrementStepIndex = () => {
		stepIndex += 1;
		return stepIndex;
	};

	// Create stream handlers
	const onStepFinish = createStepFinishHandler(
		opts,
		db,
		getCurrentPartId,
		getStepIndex,
		sharedCtx,
		updateCurrentPartId,
		updateAccumulated,
		incrementStepIndex,
		updateSessionTokensIncremental,
		updateMessageTokensIncremental,
	);

	const onError = createErrorHandler(opts, db, getStepIndex, sharedCtx);

	const onAbort = createAbortHandler(opts, db, getStepIndex, sharedCtx);

	const onFinish = createFinishHandler(
		opts,
		db,
		() => ensureFinishToolCalled(finishObserved, toolset, sharedCtx, stepIndex),
		completeAssistantMessage,
	);

	// Apply optimizations: deduplication, pruning, cache control, and truncation
	const { addCacheControl, truncateHistory } = await import(
		'./cache-optimizer.ts'
	);
	const { optimizeContext } = await import('./context-optimizer.ts');

	// 1. Optimize context (deduplicate file reads, prune old tool results)
	const contextOptimized = optimizeContext(messagesWithSystemInstructions, {
		deduplicateFiles: true,
		maxToolResults: 30,
	});

	// 2. Truncate history
	const truncatedMessages = truncateHistory(contextOptimized, 20);

	// 3. Add cache control
	const { system: cachedSystem, messages: optimizedMessages } = addCacheControl(
		opts.provider,
		system,
		truncatedMessages,
	);

	try {
		// @ts-expect-error this is fine 🔥
		const result = streamText({
			model,
			tools: toolset,
			...(cachedSystem ? { system: cachedSystem } : {}),
			messages: optimizedMessages,
			...(maxOutputTokens ? { maxOutputTokens } : {}),
			abortSignal: opts.abortSignal,
			stopWhen: hasToolCall('finish'),
			onStepFinish,
			onError,
			onAbort,
			onFinish,
		});

		for await (const delta of result.textStream) {
			if (!delta) continue;
			if (!firstDeltaSeen) {
				firstDeltaSeen = true;
				streamStartTimer.end();
			}
			accumulated += delta;
			publish({
				type: 'message.part.delta',
				sessionId: opts.sessionId,
				payload: {
					messageId: opts.assistantMessageId,
					partId: currentPartId,
					stepIndex,
					delta,
				},
			});
			await db
				.update(messageParts)
				.set({ content: JSON.stringify({ text: accumulated }) })
				.where(eq(messageParts.id, currentPartId));
		}
	} catch (error) {
		const errorPayload = toErrorPayload(error);
		await db
			.update(messageParts)
			.set({
				content: JSON.stringify({
					text: accumulated,
					error: errorPayload.message,
				}),
			})
			.where(eq(messageParts.messageId, opts.assistantMessageId));
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
				error: errorPayload.message,
				details: errorPayload.details,
			},
		});
		throw error;
	} finally {
		if (!firstToolSeen()) firstToolTimer.end({ skipped: true });
		try {
			unsubscribeFinish();
		} catch {}
		try {
			await cleanupEmptyTextParts(opts, db);
		} catch {}
	}
}
