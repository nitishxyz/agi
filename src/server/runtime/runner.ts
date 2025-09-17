import { hasToolCall, streamText, type ModelMessage } from 'ai';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { messages, messageParts } from '@/db/schema/index.ts';
import { eq, asc } from 'drizzle-orm';
import { resolveModel, type ProviderName } from '@/ai/provider.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { defaultAgentPrompts } from '@/ai/agents/defaults.ts';
import { discoverProjectTools } from '@/ai/tools/loader.ts';
import { adaptTools } from '@/ai/tools/adapter.ts';
import { publish, subscribe } from '@/server/events/bus.ts';

type RunOpts = {
	sessionId: string;
	assistantMessageId: string;
	assistantPartId: string;
	agent: string;
	provider: ProviderName;
	model: string;
	projectRoot: string;
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
	const system =
		agentCfg.prompt ||
		defaultAgentPrompts[opts.agent] ||
		'You are a helpful assistant.';
	const allTools = await discoverProjectTools(cfg.projectRoot);
	const allowedNames = new Set([
		...(agentCfg.tools || []),
		'finalize',
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
	const toolset = adaptTools(gated, sharedCtx);

	const model = resolveModel(opts.provider, opts.model, cfg);

	let currentPartId = opts.assistantPartId;
	let accumulated = '';

	// Rotate assistant text part only on tool.result boundaries for simpler ordering
	const unsubscribe = subscribe(opts.sessionId, async (evt) => {
		if (evt.type !== 'tool.result') return;
		try {
			// finalize current part by doing nothing special; we already persist text incrementally
			// start a new text part for subsequent deltas
			const newPartId = crypto.randomUUID();
			const index = await sharedCtx.nextIndex();
			const nowTs = Date.now();
			// mark current part completed
			try {
				await db
					.update(messageParts)
					.set({ completedAt: nowTs })
					.where(eq(messageParts.id, currentPartId));
			} catch {}
			await db.insert(messageParts).values({
				id: newPartId,
				messageId: opts.assistantMessageId,
				index,
				type: 'text',
				content: JSON.stringify({ text: '' }),
				agent: opts.agent,
				provider: opts.provider,
				model: opts.model,
				startedAt: nowTs,
			});
			// switch accumulation to new part
			currentPartId = newPartId;
			sharedCtx.assistantPartId = newPartId;
			accumulated = '';
		} catch {
			// ignore rotation errors to not break the run
		}
	});

	try {
		const result = streamText({
			model,
			tools: toolset,
			system,
			messages: history,
			stopWhen: hasToolCall('finalize'),
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
					delta,
				},
			});
			await db
				.update(messageParts)
				.set({ content: JSON.stringify({ text: accumulated }) })
				.where(eq(messageParts.id, currentPartId));
		}

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
			})
			.where(eq(messages.id, opts.assistantMessageId));
		// mark last text part completed
		try {
			await db
				.update(messageParts)
				.set({ completedAt: finishedAt })
				.where(eq(messageParts.id, currentPartId));
		} catch {}
		publish({
			type: 'message.completed',
			sessionId: opts.sessionId,
			payload: { id: opts.assistantMessageId },
		});
	} catch (error) {
		await db
			.update(messages)
			.set({
				status: 'error',
				error: String((error as Error)?.message ?? error),
			})
			.where(eq(messages.id, opts.assistantMessageId));
		publish({
			type: 'error',
			sessionId: opts.sessionId,
			payload: {
				messageId: opts.assistantMessageId,
				error: String((error as Error)?.message ?? error),
			},
		});
		throw error;
	} finally {
		try {
			unsubscribe();
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
		const texts = parts
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
		if (!texts) continue;
		if (m.role === 'user') out.push({ role: 'user', content: texts });
		if (m.role === 'assistant') out.push({ role: 'assistant', content: texts });
		// ignore system/tool roles here (system handled via `system` field)
	}
	return out;
}
