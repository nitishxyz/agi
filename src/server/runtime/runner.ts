import {
	hasToolCall,
	streamText,
	type ModelMessage,
	convertToModelMessages,
	type UIMessage,
} from 'ai';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { messages, messageParts, sessions } from '@/db/schema/index.ts';
import { eq, asc } from 'drizzle-orm';
import { resolveModel, type ProviderName } from '@/ai/provider.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { composeSystemPrompt } from '@/server/runtime/prompt.ts';
import { discoverProjectTools } from '@/ai/tools/loader.ts';
import { adaptTools } from '@/ai/tools/adapter.ts';
import type { ToolAdapterContext } from '@/ai/tools/adapter.ts';
import { publish, subscribe } from '@/server/events/bus.ts';
import { debugLog, time } from '@/runtime/debug.ts';
import { estimateModelCostUsd } from '@/providers/pricing.ts';

function toErrorPayload(err: unknown): {
	message: string;
	details?: Record<string, unknown>;
} {
	// Derive the best human-friendly message and optional details
	const asObj =
		err && typeof err === 'object'
			? (err as Record<string, unknown>)
			: undefined;

	// Try multiple sources for a human-readable message
	let message = '';

	if (asObj && typeof asObj.message === 'string' && asObj.message) {
		message = asObj.message as string;
	} else if (typeof err === 'string') {
		message = err as string;
	} else if (asObj && typeof asObj.error === 'string' && asObj.error) {
		message = asObj.error as string;
	} else if (
		asObj &&
		typeof asObj.responseBody === 'string' &&
		asObj.responseBody
	) {
		// For API errors, use responseBody which often contains the actual error
		message = asObj.responseBody as string;
	} else if (asObj?.statusCode && (asObj as { url?: unknown }).url) {
		// Construct a meaningful message for HTTP errors
		message = `HTTP ${String(asObj.statusCode)} error at ${String((asObj as { url?: unknown }).url)}`;
	} else if (asObj?.name) {
		// Use the error name as a fallback
		message = String(asObj.name);
	} else {
		// Last resort: try to extract something meaningful
		try {
			message = JSON.stringify(err, null, 2);
		} catch {
			message = String(err);
		}
	}

	const details: Record<string, unknown> = {};
	if (asObj && typeof asObj === 'object') {
		for (const key of ['name', 'code', 'status', 'statusCode', 'type']) {
			if (asObj[key] != null) details[key] = asObj[key];
		}
		if (asObj.cause) {
			const c = asObj.cause as Record<string, unknown> | undefined;
			details.cause = {
				message:
					typeof c?.message === 'string' ? (c.message as string) : undefined,
				code: (c as { code?: unknown })?.code,
				status:
					(c as { status?: unknown; statusCode?: unknown })?.status ??
					(c as { statusCode?: unknown })?.statusCode,
			};
		}
		// Include response data if present (common in HTTP errors)
		if (
			(asObj as { response?: { status?: unknown; statusText?: unknown } })
				?.response?.status
		)
			details.response = {
				status: (
					asObj as { response?: { status?: unknown; statusText?: unknown } }
				).response?.status,
				statusText: (
					asObj as { response?: { status?: unknown; statusText?: unknown } }
				).response?.statusText,
			};
		if (
			(asObj as { data?: unknown })?.data &&
			typeof (asObj as { data?: unknown }).data === 'object'
		)
			details.data = (asObj as { data?: unknown }).data as Record<
				string,
				unknown
			>;
	}
	return Object.keys(details).length ? { message, details } : { message };
}

type RunOpts = {
	sessionId: string;
	assistantMessageId: string;
	assistantPartId: string;
	agent: string;
	provider: ProviderName;
	model: string;
	projectRoot: string;
	oneShot?: boolean;
};

type RunnerState = { queue: RunOpts[]; running: boolean };
const runners = new Map<string, RunnerState>();

type RunnerToolContext = ToolAdapterContext & { stepIndex: number };

export function enqueueAssistantRun(opts: RunOpts) {
	const state = runners.get(opts.sessionId) ?? { queue: [], running: false };
	state.queue.push(opts);
	runners.set(opts.sessionId, state);
	if (!state.running) void processQueue(opts.sessionId);
}

async function processQueue(sessionId: string) {
	const state = runners.get(sessionId);
	if (!state) return;
	if (state.running) return;
	state.running = true;

	while (state.queue.length > 0) {
		const job = state.queue.shift();
		if (!job) break;
		try {
			await runAssistant(job);
		} catch (_err) {
			// Swallow to keep the loop alive; event published by runner
		}
	}

	state.running = false;
}

async function runAssistant(opts: RunOpts) {
	const cfgTimer = time('runner:loadConfig+db');
	const cfg = await loadConfig(opts.projectRoot);
	const db = await getDb(cfg.projectRoot);
	cfgTimer.end();

	// Resolve agent prompt and tools
	const agentTimer = time('runner:resolveAgentConfig');
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, opts.agent);
	agentTimer.end({ agent: opts.agent });
	const agentPrompt = agentCfg.prompt || '';
	const systemTimer = time('runner:composeSystemPrompt');
	const system = await composeSystemPrompt({
		provider: opts.provider,
		model: opts.model,
		projectRoot: cfg.projectRoot,
		agentPrompt,
		oneShot: opts.oneShot,
	});
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

	// Build chat history messages from DB (text parts only)
	const historyTimer = time('runner:buildHistory');
	const history = await buildHistoryMessages(db, opts.sessionId);
	historyTimer.end({ messages: history.length });

	const firstToolTimer = time('runner:first-tool-call');
	let firstToolSeen = false;
	const sharedCtx: RunnerToolContext = {
		nextIndex: async () => 0,
		stepIndex: 0,
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		assistantPartId: opts.assistantPartId,
		db,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		projectRoot: cfg.projectRoot,
		onFirstToolCall: () => {
			if (firstToolSeen) return;
			firstToolSeen = true;
			firstToolTimer.end();
		},
	};
	// Initialize a per-message monotonic index allocator
	let counter = 0;
	try {
		const existing = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, opts.assistantMessageId));
		if (existing.length) {
			const indexes = existing.map((p) => Number(p.index ?? 0));
			const maxIndex = Math.max(...indexes);
			if (Number.isFinite(maxIndex)) counter = maxIndex;
		}
	} catch {}
	sharedCtx.nextIndex = () => {
		counter += 1;
		return counter;
	};
	// initialize current step index for tools
	sharedCtx.stepIndex = 0;
	const toolset = adaptTools(gated, sharedCtx);

	const modelTimer = time('runner:resolveModel');
	const model = await resolveModel(opts.provider, opts.model, cfg);
	modelTimer.end();

	let currentPartId = opts.assistantPartId;
	let accumulated = '';
	let stepIndex = 0;

	// Track if the model called finish; fallback later if not
	let finishObserved = false;
	// Lightweight subscription to flip finishObserved when finish tool completes
	const unsubscribeFinish = subscribe(opts.sessionId, (evt) => {
		if (evt.type !== 'tool.result') return;
		try {
			const name = (evt.payload as { name?: string } | undefined)?.name;
			if (name === 'finish') finishObserved = true;
		} catch {}
	});

	const streamStartTimer = time('runner:first-delta');
	let firstDeltaSeen = false;
	try {
		const result = streamText({
			model,
			tools: toolset,
			// Only include `system` when non-empty to avoid provider errors
			...(String(system || '').trim() ? { system } : {}),
			messages: history,
			stopWhen: hasToolCall('finish'),
			onStepFinish: async (step) => {
				// close current text part and start a new one for the next step
				const finishedAt = Date.now();
				try {
					await db
						.update(messageParts)
						.set({ completedAt: finishedAt })
						.where(eq(messageParts.id, currentPartId));
				} catch {}

				// publish step info for observability
				try {
					publish({
						type: 'finish-step',
						sessionId: opts.sessionId,
						payload: {
							stepIndex,
							usage: step.usage,
							finishReason: step.finishReason,
							response: step.response,
						},
					});
					if (step.usage) {
						publish({
							type: 'usage',
							sessionId: opts.sessionId,
							payload: { stepIndex, ...step.usage },
						});
					}
				} catch {}

				// rotate to a fresh text part so next deltas have a clean container
				try {
					// increment step index for the next assistant segment
					stepIndex += 1;
					const newPartId = crypto.randomUUID();
					const index = await sharedCtx.nextIndex();
					const nowTs = Date.now();
					await db.insert(messageParts).values({
						id: newPartId,
						messageId: opts.assistantMessageId,
						index,
						stepIndex,
						type: 'text',
						content: JSON.stringify({ text: '' }),
						agent: opts.agent,
						provider: opts.provider,
						model: opts.model,
						startedAt: nowTs,
					});
					currentPartId = newPartId;
					sharedCtx.assistantPartId = newPartId;
					// expose current step index to tool adapter
					sharedCtx.stepIndex = stepIndex;
					accumulated = '';
				} catch {}
			},
			onError: async (err) => {
				const payload = toErrorPayload(err);
				await db
					.update(messages)
					.set({
						status: 'error',
						error: payload.message,
					})
					.where(eq(messages.id, opts.assistantMessageId));
				publish({
					type: 'error',
					sessionId: opts.sessionId,
					payload: {
						messageId: opts.assistantMessageId,
						error: payload.message,
						details: payload.details,
					},
				});
			},
			onAbort: async () => {
				await db
					.update(messages)
					.set({ status: 'error', error: 'aborted' })
					.where(eq(messages.id, opts.assistantMessageId));
				publish({
					type: 'error',
					sessionId: opts.sessionId,
					payload: { messageId: opts.assistantMessageId, error: 'aborted' },
				});
			},
			onFinish: async (fin) => {
				// Ensure finish is called at least once even if the model forgot
				try {
					if (!finishObserved && toolset?.finish?.execute) {
						const finishPartId = crypto.randomUUID();
						const now = Date.now();
						const idx = await sharedCtx.nextIndex();
						await db.insert(messageParts).values({
							id: finishPartId,
							messageId: opts.assistantMessageId,
							index: idx,
							stepIndex,
							type: 'tool_call',
							content: JSON.stringify({
								name: 'finish',
								args: { text: '' },
								callId: finishPartId,
							}),
							agent: opts.agent,
							provider: opts.provider,
							model: opts.model,
							startedAt: now,
							toolName: 'finish',
							toolCallId: finishPartId,
						});
						publish({
							type: 'tool.call',
							sessionId: opts.sessionId,
							payload: {
								name: 'finish',
								args: { text: '' },
								callId: finishPartId,
							},
						});
						await toolset.finish.execute(
							{ text: '' },
							// Pass AI SDK options
							{} as never,
						);
						const resultPartId = crypto.randomUUID();
						const idx2 = await sharedCtx.nextIndex();
						await db.insert(messageParts).values({
							id: resultPartId,
							messageId: opts.assistantMessageId,
							index: idx2,
							stepIndex,
							type: 'tool_result',
							content: JSON.stringify({
								name: 'finish',
								result: { done: true, text: '' },
								callId: finishPartId,
							}),
							agent: opts.agent,
							provider: opts.provider,
							model: opts.model,
							startedAt: now,
							completedAt: Date.now(),
							toolName: 'finish',
							toolCallId: finishPartId,
							toolDurationMs: Date.now() - now,
						});
						publish({
							type: 'tool.result',
							sessionId: opts.sessionId,
							payload: {
								name: 'finish',
								result: { done: true, text: '' },
								callId: finishPartId,
							},
						});
					}
				} catch {}

				// Update session token totals
				try {
					if (fin.usage) {
						const sessRows = await db
							.select()
							.from(sessions)
							.where(eq(sessions.id, opts.sessionId));
						if (sessRows.length > 0 && sessRows[0]) {
							const row = sessRows[0];
							const priorInput = Number(row.totalInputTokens ?? 0);
							const priorOutput = Number(row.totalOutputTokens ?? 0);
							const nextInput = priorInput + Number(fin.usage.inputTokens ?? 0);
							const nextOutput =
								priorOutput + Number(fin.usage.outputTokens ?? 0);
							await db
								.update(sessions)
								.set({
									totalInputTokens: nextInput,
									totalOutputTokens: nextOutput,
								})
								.where(eq(sessions.id, opts.sessionId));
						}
					}
				} catch {}

				// Complete the assistant message
				try {
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
				} catch {}

				const costUsd = fin.usage
					? estimateModelCostUsd(opts.provider, opts.model, fin.usage)
					: undefined;
				publish({
					type: 'message.completed',
					sessionId: opts.sessionId,
					payload: {
						id: opts.assistantMessageId,
						usage: fin.usage,
						costUsd,
						finishReason: fin.finishReason,
					},
				});
			},
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
			.update(messages)
			.set({
				status: 'error',
				error: errorPayload.message,
			})
			.where(eq(messages.id, opts.assistantMessageId));
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
		if (!firstToolSeen) firstToolTimer.end({ skipped: true });
		try {
			unsubscribeFinish();
		} catch {}
		// Cleanup any empty assistant text parts
		try {
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
		} catch {}
	}
}

async function buildHistoryMessages(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
): Promise<ModelMessage[]> {
	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt));

	const ui: UIMessage[] = [];

	for (const m of rows) {
		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, m.id))
			.orderBy(asc(messageParts.index));

		if (m.role === 'user') {
			// User messages only contain text
			const uparts: UIMessage['parts'] = [];
			for (const p of parts) {
				if (p.type !== 'text') continue;
				try {
					const obj = JSON.parse(p.content ?? '{}');
					const t = String(obj.text ?? '');
					if (t) uparts.push({ type: 'text', text: t });
				} catch {}
			}
			if (uparts.length) {
				ui.push({ id: m.id, role: 'user', parts: uparts });
			}
			continue;
		}

		if (m.role === 'assistant') {
			// For assistant messages, we need to split into two parts:
			// 1. Assistant message with text and tool calls
			// 2. User message with tool results (if there are any)

			const assistantParts: UIMessage['parts'] = [];
			const toolCalls: Array<{ name: string; callId: string; args: unknown }> =
				[];
			const toolResults: Array<{
				name: string;
				callId: string;
				result: unknown;
			}> = [];

			// Collect all parts
			for (const p of parts) {
				if (p.type === 'text') {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						const t = String(obj.text ?? '');
						if (t) assistantParts.push({ type: 'text', text: t });
					} catch {}
				} else if (p.type === 'tool_call') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							callId?: string;
							args?: unknown;
						};
						if (obj.callId && obj.name) {
							toolCalls.push({
								name: obj.name,
								callId: obj.callId,
								args: obj.args,
							});
						}
					} catch {}
				} else if (p.type === 'tool_result') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							callId?: string;
							result?: unknown;
						};
						if (obj.callId) {
							toolResults.push({
								name: obj.name ?? 'tool',
								callId: obj.callId,
								result: obj.result,
							});
						}
					} catch {}
				}
			}

			// Check if all tool calls have results
			const hasIncompleteTools = toolCalls.some(
				(call) => !toolResults.find((result) => result.callId === call.callId),
			);

			if (hasIncompleteTools) {
				// Include text even if tools are incomplete
				debugLog(
					`[buildHistoryMessages] Incomplete tool calls for assistant message ${m.id}, pushing text only`,
				);
				if (assistantParts.length) {
					ui.push({ id: m.id, role: 'assistant', parts: assistantParts });
				}
				continue;
			}

			// Add tool calls to assistant message
			for (const call of toolCalls) {
				const toolType = `tool-${call.name}` as `tool-${string}`;
				const result = toolResults.find((r) => r.callId === call.callId);

				if (result) {
					// Add the tool call with its result as a completed tool part
					const outputStr = (() => {
						const r = result.result;
						if (typeof r === 'string') return r;
						try {
							return JSON.stringify(r);
						} catch {
							return String(r);
						}
					})();

					assistantParts.push({
						type: toolType,
						state: 'output-available',
						toolCallId: call.callId,
						input: call.args,
						output: outputStr,
					} as never);
				}
			}

			// Add the assistant message if it has content
			if (assistantParts.length) {
				ui.push({ id: m.id, role: 'assistant', parts: assistantParts });

				// Emit separate user message for tool results
				if (toolResults.length) {
					const userParts: UIMessage['parts'] = toolResults.map((r) => {
						const out =
							typeof r.result === 'string'
								? r.result
								: JSON.stringify(r.result);
						return { type: 'text', text: out };
					});
					if (userParts.length) {
						ui.push({ id: m.id, role: 'user', parts: userParts });
					}
				}
			}
		}
	}

	return convertToModelMessages(ui);
}
