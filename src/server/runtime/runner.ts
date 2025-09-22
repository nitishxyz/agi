import { hasToolCall, streamText, type ModelMessage } from 'ai';
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
	const asAny = err as Record<string, any> | undefined;

	// Try multiple sources for a human-readable message
	let message = '';

	if (asAny && typeof asAny.message === 'string' && asAny.message) {
		message = asAny.message;
	} else if (typeof err === 'string') {
		message = err as string;
	} else if (asAny && typeof asAny.error === 'string' && asAny.error) {
		message = asAny.error;
	} else if (
		asAny &&
		typeof asAny.responseBody === 'string' &&
		asAny.responseBody
	) {
		// For API errors, use responseBody which often contains the actual error
		message = asAny.responseBody;
	} else if (asAny && asAny.statusCode && asAny.url) {
		// Construct a meaningful message for HTTP errors
		message = `HTTP ${asAny.statusCode} error at ${asAny.url}`;
	} else if (asAny && asAny.name) {
		// Use the error name as a fallback
		message = String(asAny.name);
	} else {
		// Last resort: try to extract something meaningful
		try {
			message = JSON.stringify(err, null, 2);
		} catch {
			message = String(err);
		}
	}

	const details: Record<string, unknown> = {};
	if (asAny && typeof asAny === 'object') {
		for (const key of ['name', 'code', 'status', 'statusCode', 'type']) {
			if (asAny[key] != null) details[key] = asAny[key];
		}
		if (asAny.cause) {
			const c = asAny.cause as any;
			details.cause = {
				message: typeof c?.message === 'string' ? c.message : undefined,
				code: c?.code,
				status: c?.status ?? c?.statusCode,
			};
		}
		// Include response data if present (common in HTTP errors)
		if (asAny.response?.status)
			details.response = {
				status: asAny.response.status,
				statusText: asAny.response.statusText,
			};
		if (asAny.data && typeof asAny.data === 'object') details.data = asAny.data;
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

	const sharedCtx = {
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
	// @ts-expect-error augment at runtime
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
			system,
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
					// @ts-expect-error augment at runtime
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
	const msgs = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt));
	const out: ModelMessage[] = [];
	for (const m of msgs) {
		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, m.id))
			.orderBy(asc(messageParts.index));
		if (m.role === 'user') {
			// Users only: stitch text parts (ignore any other types if present)
			const text = parts
				.filter((p) => p.type === 'text')
				.map((p) => {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						return String(obj.text ?? '');
					} catch {
						return '';
					}
				})
				.join('');
			if (text.trim().length) out.push({ role: 'user', content: text });
			continue;
		}
		if (m.role === 'assistant') {
			// Assistants: include ALL parts in order — text, tool_call, tool_result — verbatim
			const chunks: string[] = [];
			for (const p of parts) {
				if (p.type === 'text') {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						const t = String(obj.text ?? '');
						if (t) chunks.push(t);
					} catch {}
				} else if (p.type === 'tool_call') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							args?: unknown;
							callId?: string;
						};
						const name = obj.name ?? 'tool';
						const argsPretty = JSON.stringify(obj.args ?? {}, null, 2);
						chunks.push(`Tool call: ${name}\nArgs:\n${argsPretty}`);
					} catch {}
				} else if (p.type === 'tool_result') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							result?: unknown;
							artifact?: unknown;
						};
						const name = obj.name ?? 'tool';
						const resultPretty = JSON.stringify(obj.result ?? {}, null, 2);
						chunks.push(`Tool result: ${name}\nResult:\n${resultPretty}`);
						if (obj.artifact !== undefined) {
							const art = obj.artifact as Record<string, unknown>;
							const patch =
								typeof art?.patch === 'string' ? art.patch : undefined;
							if (patch?.trim().length) {
								chunks.push(`Artifact patch:\n${patch}`);
							} else {
								const artPretty = JSON.stringify(art ?? {}, null, 2);
								chunks.push(`Artifact:\n${artPretty}`);
							}
						}
					} catch {}
				}
			}
			const body = chunks.join('\n\n');
			if (body.trim().length) out.push({ role: 'assistant', content: body });
		}
		// ignore other roles (system handled via `system` field)
	}
	return out;
}
