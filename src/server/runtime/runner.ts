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
import { publish, subscribe } from '@/server/events/bus.ts';
import { debugLog } from '@/runtime/debug.ts';
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
	const cfg = await loadConfig(opts.projectRoot);
	const db = await getDb(cfg.projectRoot);

	// Resolve agent prompt and tools
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, opts.agent);
	const agentPrompt = agentCfg.prompt || '';
	const system = await composeSystemPrompt({
		provider: opts.provider,
		model: opts.model,
		projectRoot: cfg.projectRoot,
		agentPrompt,
		oneShot: opts.oneShot,
	});
	debugLog('[system] composed prompt (provider+base+agent):');
	debugLog(system);
	const allTools = await discoverProjectTools(cfg.projectRoot);
	const allowedNames = new Set([
		...(agentCfg.tools || []),
		'finish',
		'progress_update',
	]);
	const gated = allTools.filter((t) => allowedNames.has(t.name));

	// Build chat history messages from DB (text parts only)
	const history = await buildHistoryMessages(db, opts.sessionId);

	const sharedCtx: any = {
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		assistantPartId: opts.assistantPartId,
		db,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		projectRoot: cfg.projectRoot,
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

	const model = await resolveModel(opts.provider, opts.model, cfg);

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
					if (!finishObserved && toolset?.finish) {
						const text = accumulated?.trim() ? accumulated : undefined;
						await toolset.finish.onInputAvailable?.({
							input: { text },
						} as never);
						await toolset.finish.execute?.(
							{ text } as never,
							undefined as never,
						);
					}
				} catch {}

				// Mark message completion and latency
				let createdAt = undefined as number | undefined;
				try {
					const row = await db
						.select()
						.from(messages)
						.where(eq(messages.id, opts.assistantMessageId));
					if (row.length)
						createdAt =
							row[0]?.createdAt != null ? Number(row[0].createdAt) : undefined;
				} catch {}
				const finishedAt = Date.now();
				const latency =
					typeof createdAt === 'number'
						? Math.max(0, finishedAt - createdAt)
						: null;

				await db
					.update(messages)
					.set({
						status: 'complete',
						completedAt: finishedAt,
						latencyMs: latency ?? undefined,
						promptTokens:
							fin.usage?.inputTokens != null
								? Number(fin.usage.inputTokens)
								: undefined,
						completionTokens:
							fin.usage?.outputTokens != null
								? Number(fin.usage.outputTokens)
								: undefined,
						totalTokens:
							fin.usage?.totalTokens != null
								? Number(fin.usage.totalTokens)
								: undefined,
					})
					.where(eq(messages.id, opts.assistantMessageId));

				if (fin.usage && (fin.usage.inputTokens || fin.usage.outputTokens)) {
					try {
						const sessRows = await db
							.select()
							.from(sessions)
							.where(eq(sessions.id, opts.sessionId));
						if (sessRows.length) {
							const row = sessRows[0]!;
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
									lastActiveAt: finishedAt,
								})
								.where(eq(sessions.id, opts.sessionId));
						}
					} catch {}
				}

				// mark last text part completed
				try {
					await db
						.update(messageParts)
						.set({ completedAt: finishedAt })
						.where(eq(messageParts.id, currentPartId));
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
			const uparts: UIMessage['parts'] = [];
			for (const p of parts) {
				if (p.type !== 'text') continue;
				try {
					const obj = JSON.parse(p.content ?? '{}');
					const t = String(obj.text ?? '');
					if (t) uparts.push({ type: 'text', text: t });
				} catch {}
			}
			if (uparts.length) ui.push({ id: m.id, role: 'user', parts: uparts });
			continue;
		}

		if (m.role === 'assistant') {
			const aparts: UIMessage['parts'] = [];
			const callArgsById = new Map<string, unknown>();
			const resultsByCallId = new Map<string, unknown>();
			let incompletePairs = 0;

			// First pass: capture tool call inputs and results by callId
			for (const p of parts) {
				if (p.type === 'tool_call') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							callId?: string;
							args?: unknown;
						};
						if (obj.callId) callArgsById.set(obj.callId, obj.args);
					} catch {}
				} else if (p.type === 'tool_result') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							callId?: string;
							result?: unknown;
						};
						if (obj.callId) resultsByCallId.set(obj.callId, obj.result);
					} catch {}
				}
			}

			// Count incomplete pairs
			for (const [callId] of callArgsById) {
				if (!resultsByCallId.has(callId)) {
					incompletePairs++;
				}
			}

			if (incompletePairs > 0) {
				debugLog(
					`[buildHistoryMessages] Filtering out ${incompletePairs} incomplete tool call/result pairs`,
				);
			}

			// Second pass: include text and ONLY completed tool call/result pairs in order
			for (const p of parts) {
				if (p.type === 'text') {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						const t = String(obj.text ?? '');
						if (t) aparts.push({ type: 'text', text: t });
					} catch {}
					continue;
				}
				if (p.type === 'tool_result') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							callId?: string;
							result?: unknown;
						};
						const name = (obj.name ?? 'tool').toString();
						const toolType = `tool-${name}` as `tool-${string}`;
						const callId = obj.callId ?? '';

						// Only include results that have both a call AND a result
						const input = callId ? callArgsById.get(callId) : undefined;
						const hasResult = callId ? resultsByCallId.has(callId) : false;

						// Skip if we don't have both call and result
						if (!callId || input === undefined || !hasResult) continue;

						const outputStr = (() => {
							const r = obj.result;
							if (typeof r === 'string') return r;
							try {
								return JSON.stringify(r);
							} catch {
								return String(r);
							}
						})();
						aparts.push({
							type: toolType,
							state: 'output-available',
							toolCallId: callId,
							input,
							output: outputStr,
						} as never);
					} catch {}
				}
			}

			// Check if this assistant message has any incomplete tool calls
			// (calls without results). If so, we skip the entire message.
			let hasIncompleteCalls = false;
			for (const [callId] of callArgsById) {
				if (!resultsByCallId.has(callId)) {
					hasIncompleteCalls = true;
					break;
				}
			}

			// Only include the assistant message if:
			// 1. It has parts (text or completed tool pairs), AND
			// 2. It doesn't have any incomplete tool calls
			if (aparts.length && !hasIncompleteCalls) {
				ui.push({ id: m.id, role: 'assistant', parts: aparts });
			} else if (hasIncompleteCalls) {
				debugLog(
					`[buildHistoryMessages] Skipping assistant message ${m.id} with incomplete tool calls`,
				);
			}
		}
	}

	return convertToModelMessages(ui);
}
