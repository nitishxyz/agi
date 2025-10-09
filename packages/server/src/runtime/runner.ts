import { streamText } from 'ai';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { resolveModel } from './provider.ts';
import { resolveAgentConfig } from './agent-registry.ts';
import { composeSystemPrompt } from './prompt.ts';
import { discoverProjectTools } from '@agi-cli/sdk';
import { publish } from '../events/bus.ts';
import { buildHistoryMessages } from './history-builder.ts';
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
import { setupToolContext } from './tool-context-setup.ts';
import {
	updateSessionTokensIncremental,
	updateMessageTokensIncremental,
	completeAssistantMessage,
} from './db-operations.ts';
import {
	createStepFinishHandler,
	createErrorHandler,
	createAbortHandler,
	createFinishHandler,
} from './stream-handlers.ts';
import { addCacheControl } from './cache-optimizer.ts';
import { optimizeContext } from './context-optimizer.ts';
import { truncateHistory } from './history-truncator.ts';

/**
 * Main runner that executes the LLM streaming loop with tools
 */
export async function runAssistant(opts: RunOpts) {
	const db = await getDb();
	const config = await loadConfig();
	const [provider, modelName] = opts.model.split('/', 2);
	const model = resolveModel(provider, modelName);

	// Build agent + system prompt
	const agentConfig = resolveAgentConfig(opts.agent);
	const availableTools = await discoverProjectTools(config.project.root);
	const system = composeSystemPrompt(agentConfig, availableTools);

	// Build message history
	const history = await buildHistoryMessages(opts, db);

	// Setup tool context
	const toolContext = await setupToolContext(opts, db);
	const { tools, sharedCtx } = toolContext;

	// State
	let currentPartId = sharedCtx.assistantPartId;
	let stepIndex = sharedCtx.stepIndex;
	let accumulated = '';
	const abortController = new AbortController();

	// State getters/setters
	const getCurrentPartId = () => currentPartId;
	const getStepIndex = () => stepIndex;
	const updateCurrentPartId = (id: string) => {
		currentPartId = id;
	};
	const updateAccumulated = (text: string) => {
		accumulated = text;
	};
	const getAccumulated = () => accumulated;
	const incrementStepIndex = () => ++stepIndex;

	// Handlers
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

	const onFinish = createFinishHandler(
		opts,
		db,
		completeAssistantMessage,
		getAccumulated,
		abortController,
	);

	const _onAbort = createAbortHandler(opts, db, abortController);
	const onError = createErrorHandler(opts, db);

	// Context optimization
	const contextOptimized = optimizeContext(history, {
		deduplicateFiles: true,
		maxToolResults: 30,
	});

	// Truncate history
	const truncatedMessages = truncateHistory(contextOptimized, 20);

	// Add cache control
	const { system: cachedSystem, messages: optimizedMessages } = addCacheControl(
		opts.provider,
		system,
		truncatedMessages,
	);

	try {
		const maxTokens = getMaxOutputTokens(provider, modelName);
		const result = await streamText({
			model,
			system: cachedSystem,
			messages: optimizedMessages,
			tools,
			maxSteps: 50,
			maxTokens,
			temperature: agentConfig.temperature ?? 0.7,
			abortSignal: abortController.signal,
			onStepFinish,
			onFinish,
			experimental_continueSteps: true,
		});

		// Process the stream
		for await (const delta of result.textStream) {
			if (abortController.signal.aborted) break;

			accumulated += delta;
			if (currentPartId) {
				await db
					.update(messageParts)
					.set({ content: accumulated })
					.where(eq(messageParts.id, currentPartId));
			}

			publish('stream:text-delta', {
				sessionId: opts.sessionId,
				messageId: opts.assistantMessageId,
				assistantMessageId: opts.assistantMessageId,
				stepIndex,
				textDelta: delta,
				fullText: accumulated,
			});
		}
	} catch (err) {
		await onError(err);
	} finally {
		setRunning(opts.sessionId, false);
		dequeueJob(opts.sessionId);
	}
}

/**
 * Enqueues an assistant run
 */
export async function enqueueAssistantRun(opts: RunOpts) {
	return enqueueRun(opts);
}

/**
 * Aborts a running session
 */
export async function abortSession(sessionId: number) {
	return abortSessionQueue(sessionId);
}

/**
 * Gets the current runner state for a session
 */
export function getSessionState(sessionId: number) {
	return getRunnerState(sessionId);
}

/**
 * Cleanup session resources
 */
export function cleanupSessionResources(sessionId: number) {
	return cleanupSession(sessionId);
}
