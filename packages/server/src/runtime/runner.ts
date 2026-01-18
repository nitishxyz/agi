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
	setRunning,
	dequeueJob,
	cleanupSession,
} from './session-queue.ts';
import { setupToolContext } from './tool-context-setup.ts';
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

export { enqueueAssistantRun, abortSession } from './session-queue.ts';
export { getRunnerState } from './session-queue.ts';

/**
 * Main loop that processes the queue for a given session.
 */
export async function runSessionLoop(sessionId: string) {
	setRunning(sessionId, true);

	while (true) {
		const job = await dequeueJob(sessionId);
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
 * Main function to run the assistant for a given request.
 */
async function runAssistant(opts: RunOpts) {
	const separator = '='.repeat(72);
	debugLog(separator);
	debugLog(
		`[RUNNER] Starting turn for session ${opts.sessionId}, message ${opts.assistantMessageId}`,
	);

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

	// FIX: For OAuth, we need to check if this is the first ASSISTANT message
	// The user message is already in history by this point, so history.length will be > 0
	// We need to add additionalSystemMessages on the first assistant turn
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
	const { getProviderSpoofPrompt } = await import('./prompt.ts');
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
	let additionalSystemMessages: Array<{ role: 'system'; content: string }> = [];

	if (spoofPrompt) {
		// OAuth mode: short spoof in system field, full instructions in messages array
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
		});
		oauthFullPromptComponents = fullPrompt.components;

		// FIX: Always add the system message for OAuth because:
		// 1. System messages are NOT stored in the database
		// 2. buildHistoryMessages only returns user/assistant messages
		// 3. We need the full instructions on every turn
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
		// API key mode: full instructions in system field
		const composed = await composeSystemPrompt({
			provider: opts.provider,
			model: opts.model,
			projectRoot: cfg.projectRoot,
			agentPrompt,
			oneShot: opts.oneShot,
			spoofPrompt: undefined,
			includeProjectTree: isFirstMessage,
			userContext: opts.userContext,
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

	const toolsTimer = time('runner:discoverTools');
	const allTools = await discoverProjectTools(cfg.projectRoot);
	toolsTimer.end({ count: allTools.length });
	const allowedNames = new Set([...(agentCfg.tools || []), 'finish']);
	const gated = allTools.filter((tool) => allowedNames.has(tool.name));
	debugLog(`[tools] ${gated.length} allowed tools`);

	// FIX: For OAuth, ALWAYS prepend the system message because it's never in history
	// For API key mode, only add on first message (when additionalSystemMessages is empty)
	const messagesWithSystemInstructions: Array<{
		role: string;
		content: string | Array<unknown>;
	}> = [
		...additionalSystemMessages, // Always add for OAuth, empty for API key mode
		...history,
	];

	// Inject a reminder for subsequent turns to prevent "abrupt stops"
	// This reinforces the instruction to call finish and maintain context
	if (!isFirstMessage) {
		messagesWithSystemInstructions.push({
			role: 'user',
			content:
				'SYSTEM REMINDER: You are continuing an existing session. When you have completed the task, you MUST stream a text summary of what you did to the user, and THEN call the `finish` tool. Do not call `finish` without a summary.',
		});
	}

	debugLog(`[RUNNER] About to create model with provider: ${opts.provider}`);
	debugLog(`[RUNNER] About to create model ID: ${opts.model}`);
	debugLog(
		`[RUNNER] messagesWithSystemInstructions length: ${messagesWithSystemInstructions.length}`,
	);
	debugLog(
		`[RUNNER] additionalSystemMessages length: ${additionalSystemMessages.length}`,
	);
	if (additionalSystemMessages.length > 0) {
		debugLog(
			'[RUNNER] ✅ additionalSystemMessages ADDED to messagesWithSystemInstructions',
		);
		debugLog(
			`[RUNNER] This happens on EVERY turn for OAuth (system messages not stored in DB)`,
		);
	}

	const model = await resolveModel(opts.provider, opts.model, cfg);
	debugLog(
		`[RUNNER] Model created: ${JSON.stringify({ id: model.modelId, provider: model.provider })}`,
	);

	const maxOutputTokens = getMaxOutputTokens(opts.provider, opts.model);
	debugLog(`[RUNNER] maxOutputTokens for ${opts.model}: ${maxOutputTokens}`);

	// Setup tool context
	const { sharedCtx, firstToolTimer, firstToolSeen } = await setupToolContext(
		opts,
		db,
	);

	// Get auth type for Claude Code OAuth detection
	const providerAuth = await getAuth(opts.provider, opts.projectRoot);
	const authType = providerAuth?.type;
	const toolset = adaptTools(gated, sharedCtx, opts.provider, authType);

	let _finishObserved = false;
	const unsubscribeFinish = subscribe(opts.sessionId, (evt) => {
		if (evt.type !== 'tool.result') return;
		try {
			const name = (evt.payload as { name?: string } | undefined)?.name;
			if (name === 'finish') _finishObserved = true;
		} catch {}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;
	debugLog(`[streamText] Calling with maxOutputTokens: ${maxOutputTokens}`);

	// State management helpers
	const getCurrentPartId = () => currentPartId;
	const getStepIndex = () => stepIndex;
	const updateCurrentPartId = (id: string | null) => {
		currentPartId = id;
	};
	const updateAccumulated = (text: string) => {
		accumulated = text;
	};
	const incrementStepIndex = () => {
		stepIndex += 1;
		return stepIndex;
	};

	type ReasoningState = {
		partId: string;
		text: string;
		providerMetadata?: unknown;
	};
	const reasoningStates = new Map<string, ReasoningState>();
	const serializeReasoningContent = (state: ReasoningState) =>
		JSON.stringify(
			state.providerMetadata != null
				? { text: state.text, providerMetadata: state.providerMetadata }
				: { text: state.text },
		);

	// Create stream handlers
	const onStepFinish = createStepFinishHandler(
		opts,
		db,
		getStepIndex,
		incrementStepIndex,
		getCurrentPartId,
		updateCurrentPartId,
		updateAccumulated,
		sharedCtx,
		updateSessionTokensIncremental,
		updateMessageTokensIncremental,
	);

	const onError = createErrorHandler(opts, db, getStepIndex, sharedCtx);

	const onAbort = createAbortHandler(opts, db, getStepIndex, sharedCtx);

	const onFinish = createFinishHandler(opts, db, completeAssistantMessage);

	// Use messages directly without truncation or optimization
	const optimizedMessages = messagesWithSystemInstructions;
	const cachedSystem = system;

	// Part tracking - will be created on first text-delta
	let currentPartId: string | null = null;
	let accumulated = '';
	let stepIndex = 0;

	// Build provider options for reasoning/extended thinking
	const providerOptions: Record<string, unknown> = {};
	const THINKING_BUDGET = 16000;
	// When reasoning is enabled for Anthropic, the API requires max_tokens to fit
	// both thinking tokens AND response tokens. AI SDK adds budgetTokens to maxOutputTokens,
	// so we need to reduce maxOutputTokens to leave room for thinking.
	let effectiveMaxOutputTokens = maxOutputTokens;

	if (opts.reasoning) {
		if (opts.provider === 'anthropic') {
			providerOptions.anthropic = {
				thinking: { type: 'enabled', budgetTokens: THINKING_BUDGET },
			};
			// Reduce max output to leave room for thinking budget
			if (maxOutputTokens && maxOutputTokens > THINKING_BUDGET) {
				effectiveMaxOutputTokens = maxOutputTokens - THINKING_BUDGET;
			}
		} else if (opts.provider === 'openai') {
			providerOptions.openai = {
				reasoningSummary: 'auto',
			};
		} else if (opts.provider === 'google') {
			providerOptions.google = {
				thinkingConfig: { thinkingBudget: THINKING_BUDGET },
			};
		}
	}

	try {
		const result = streamText({
			model,
			tools: toolset,
			...(cachedSystem ? { system: cachedSystem } : {}),
			messages: optimizedMessages,
			...(effectiveMaxOutputTokens
				? { maxOutputTokens: effectiveMaxOutputTokens }
				: {}),
			...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
			abortSignal: opts.abortSignal,
			stopWhen: hasToolCall('finish'),
			onStepFinish,
			onError,
			onAbort,
			onFinish,
		});

		for await (const part of result.fullStream) {
			if (!part) continue;
			if (part.type === 'text-delta') {
				const delta = part.text;
				if (!delta) continue;
				if (!firstDeltaSeen) {
					firstDeltaSeen = true;
					streamStartTimer.end();
				}

				// Create text part on first delta
				if (!currentPartId) {
					currentPartId = crypto.randomUUID();
					sharedCtx.assistantPartId = currentPartId;
					await db.insert(messageParts).values({
						id: currentPartId,
						messageId: opts.assistantMessageId,
						index: sharedCtx.nextIndex(),
						stepIndex: null,
						type: 'text',
						content: JSON.stringify({ text: '' }),
						agent: opts.agent,
						provider: opts.provider,
						model: opts.model,
						startedAt: Date.now(),
					});
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
				continue;
			}

			if (part.type === 'reasoning-start') {
				const reasoningId = part.id;
				if (!reasoningId) continue;
				const reasoningPartId = crypto.randomUUID();
				const state: ReasoningState = {
					partId: reasoningPartId,
					text: '',
					providerMetadata: part.providerMetadata,
				};
				reasoningStates.set(reasoningId, state);
				try {
					await db.insert(messageParts).values({
						id: reasoningPartId,
						messageId: opts.assistantMessageId,
						index: sharedCtx.nextIndex(),
						stepIndex: getStepIndex(),
						type: 'reasoning',
						content: serializeReasoningContent(state),
						agent: opts.agent,
						provider: opts.provider,
						model: opts.model,
						startedAt: Date.now(),
					});
				} catch {}
				continue;
			}

			if (part.type === 'reasoning-delta') {
				const state = reasoningStates.get(part.id);
				if (!state) continue;
				state.text += part.text;
				if (part.providerMetadata != null) {
					state.providerMetadata = part.providerMetadata;
				}
				publish({
					type: 'reasoning.delta',
					sessionId: opts.sessionId,
					payload: {
						messageId: opts.assistantMessageId,
						partId: state.partId,
						stepIndex: getStepIndex(),
						delta: part.text,
					},
				});
				try {
					await db
						.update(messageParts)
						.set({ content: serializeReasoningContent(state) })
						.where(eq(messageParts.id, state.partId));
				} catch {}
				continue;
			}

			if (part.type === 'reasoning-end') {
				const state = reasoningStates.get(part.id);
				if (!state) continue;
				// Delete the reasoning part if it's empty
				if (!state.text || state.text.trim() === '') {
					try {
						await db
							.delete(messageParts)
							.where(eq(messageParts.id, state.partId));
					} catch {}
					reasoningStates.delete(part.id);
					continue;
				}
				try {
					await db
						.update(messageParts)
						.set({ completedAt: Date.now() })
						.where(eq(messageParts.id, state.partId));
				} catch {}
				reasoningStates.delete(part.id);
			}
		}

		// Emit finish-step at the end if there were no tool calls and no finish
		const fs = firstToolSeen();
		if (!fs && !_finishObserved) {
			publish({
				type: 'finish-step',
				sessionId: opts.sessionId,
				payload: { reason: 'no-tool-calls' },
			});
		}

		unsubscribeFinish();

		await cleanupEmptyTextParts(opts, db);

		firstToolTimer.end({ seen: firstToolSeen() });

		debugLog(
			`[RUNNER] Stream finished. finishSeen=${_finishObserved}, firstToolSeen=${fs}`,
		);
	} catch (err) {
		unsubscribeFinish();
		const payload = toErrorPayload(err);
		debugLog(`[RUNNER] Error during stream: ${payload.message}`);
		debugLog(
			`[RUNNER] Error stack: ${err instanceof Error ? err.stack : 'no stack'}`,
		);
		debugLog(
			`[RUNNER] db is: ${typeof db}, db.select is: ${typeof db?.select}`,
		);
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload,
		});
		try {
			await updateSessionTokensIncremental(
				{
					inputTokens: 0,
					outputTokens: 0,
				},
				undefined,
				opts,
				db,
			);
			await updateMessageTokensIncremental(
				{
					inputTokens: 0,
					outputTokens: 0,
				},
				undefined,
				opts,
				db,
			);
			await completeAssistantMessage({}, opts, db);
		} catch {}
		throw err;
	} finally {
		debugLog(
			`[RUNNER] Turn complete for session ${opts.sessionId}, message ${opts.assistantMessageId}`,
		);
		debugLog(separator);
	}
}
