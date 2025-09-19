import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { messages, messageParts, sessions } from '@/db/schema/index.ts';
import { eq, inArray } from 'drizzle-orm';
import { validateProviderModel } from '@/providers/validate.ts';
import {
	isProviderAuthorized,
	ensureProviderEnv,
} from '@/providers/authorization.ts';
import { publish } from '@/server/events/bus.ts';
import { generateText } from 'ai';
import { resolveModel, type ProviderName } from '@/ai/provider.ts';
import { enqueueAssistantRun } from '@/server/runtime/runner.ts';

type MessagePartRow = typeof messageParts.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

export function registerSessionMessagesRoutes(app: Hono) {
	// List messages for a session
	app.get('/v1/sessions/:id/messages', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const id = c.req.param('id');
		const rows = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, id))
			.orderBy(messages.createdAt);
		const without = c.req.query('without');
		if (without !== 'parts') {
			const ids = rows.map((m) => m.id);
			const parts = ids.length
				? await db
						.select()
						.from(messageParts)
						.where(inArray(messageParts.messageId, ids))
				: [];
			const partsByMsg = new Map<string, MessagePartRow[]>();
			for (const p of parts) {
				const existing = partsByMsg.get(p.messageId);
				if (existing) existing.push(p);
				else partsByMsg.set(p.messageId, [p]);
			}
			const enriched = rows.map((m) => ({
				...m,
				parts: (partsByMsg.get(m.id) ?? []).sort((a, b) => a.index - b.index),
			}));
			return c.json(enriched);
		}
		return c.json(rows);
	});

	// Post a user message and get assistant reply (non-streaming for v0)
	app.post('/v1/sessions/:id/messages', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const sessionId = c.req.param('id');
		const body = await c.req.json().catch(() => ({}));
		// Load session to inherit its provider/model/agent by default
		const sessionRows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		if (!sessionRows.length) return c.json({ error: 'Session not found' }, 404);
		const sess: SessionRow = sessionRows[0];
		const provider = body?.provider ?? sess.provider ?? cfg.defaults.provider;
		const modelName = body?.model ?? sess.model ?? cfg.defaults.model;
		const agent = body?.agent ?? sess.agent ?? cfg.defaults.agent;
		const content = body?.content ?? '';

		// Validate model capabilities if tools are allowed for this agent
		const wantsToolCalls = true; // agent toolset may be non-empty
		try {
			validateProviderModel(provider, modelName, { wantsToolCalls });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json({ error: message }, 400);
		}
		// Enforce provider auth: only allow providers/models the user authenticated for
		const authorized = await isProviderAuthorized(cfg, provider);
		if (!authorized) {
			return c.json(
				{
					error: `Provider ${provider} is not configured. Run \`agi auth login\` to add credentials.`,
				},
				400,
			);
		}
		await ensureProviderEnv(cfg, provider);

		const now = Date.now();
		const userMessageId = crypto.randomUUID();
		await db.insert(messages).values({
			id: userMessageId,
			sessionId,
			role: 'user',
			status: 'complete',
			agent,
			provider,
			model: modelName,
			createdAt: now,
		});
		await db.insert(messageParts).values({
			id: crypto.randomUUID(),
			messageId: userMessageId,
			index: 0,
			type: 'text',
			content: JSON.stringify({ text: String(content) }),
			agent,
			provider,
			model: modelName,
		});
		publish({
			type: 'message.created',
			sessionId,
			payload: { id: userMessageId, role: 'user' },
		});

		// If the session has no title yet, derive a short title from this first user message.
		// Do this best-effort and non-blocking; keep it simple and local (no model call).
		(async () => {
			try {
				const rows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId));
				if (!rows.length) return;
				const current = rows[0];
				const alreadyHasTitle =
					current.title != null && String(current.title).trim().length > 0;
				let heuristic = '';
				if (!alreadyHasTitle) {
					heuristic = deriveTitle(String(content ?? ''));
					if (heuristic) {
						await db
							.update(sessions)
							.set({ title: heuristic })
							.where(eq(sessions.id, sessionId));
						publish({
							type: 'session.updated',
							sessionId,
							payload: { title: heuristic },
						});
					}
				}

				// Background: ask the model for a concise title
				const cfg = await loadConfig(projectRoot);
				const model = await resolveModel(provider as ProviderName, modelName, cfg);
				const promptText = String(content ?? '').slice(0, 2000);
				const sys = [
					"Create a short, descriptive session title from the user's request.",
					'Max 6–8 words. No quotes. No trailing punctuation.',
					'Avoid generic phrases like "help me"; be specific.',
				].join(' ');
				let modelTitle = '';
				try {
				const out = await generateText({
					model,
					system: sys,
					prompt: promptText,
				});
					modelTitle = (out?.text || '').trim();
				} catch {}
				if (!modelTitle) return;
				modelTitle = sanitizeTitle(modelTitle);
				if (!modelTitle) return;

				// Only set if the title is still empty or equals the heuristic we just set
				const check = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId));
				if (!check.length) return;
				const currentTitle = String(check[0].title ?? '').trim();
				if (currentTitle && currentTitle !== heuristic) return;
				await db
					.update(sessions)
					.set({ title: modelTitle })
					.where(eq(sessions.id, sessionId));
				publish({
					type: 'session.updated',
					sessionId,
					payload: { title: modelTitle },
				});
			} catch {}
		})();

		// Create assistant message in pending state and an empty part to update as we stream
		const assistantMessageId = crypto.randomUUID();
		await db.insert(messages).values({
			id: assistantMessageId,
			sessionId,
			role: 'assistant',
			status: 'pending',
			agent,
			provider,
			model: modelName,
			createdAt: Date.now(),
		});
		const assistantPartId = crypto.randomUUID();
		const startTs = Date.now();
		await db.insert(messageParts).values({
			id: assistantPartId,
			messageId: assistantMessageId,
			index: 0,
			type: 'text',
			content: JSON.stringify({ text: '' }),
			agent,
			provider,
			model: modelName,
			startedAt: startTs,
		});
		publish({
			type: 'message.created',
			sessionId,
			payload: { id: assistantMessageId, role: 'assistant' },
		});

		// Enqueue background processing in centralized runner and return immediately
		enqueueAssistantRun({
			sessionId,
			assistantMessageId,
			assistantPartId,
			agent,
			provider,
			model: modelName,
			projectRoot: cfg.projectRoot,
		});

		// touch session last active
		try {
			await db
				.update(sessions)
				.set({ lastActiveAt: Date.now() })
				.where(eq(sessions.id, sessionId));
		} catch {}

		return c.json({ messageId: assistantMessageId }, 202);
	});
}

function deriveTitle(text: string): string {
	const cleaned = String(text || '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return '';
	// Prefer the first sentence or question up to ~64 chars
	const endIdx = (() => {
		const punct = ['? ', '. ', '! ']
			.map((p) => cleaned.indexOf(p))
			.filter((i) => i > 0);
		const idx = Math.min(...(punct.length ? punct : [cleaned.length]));
		return Math.min(idx + 1, cleaned.length);
	})();
	const first = cleaned.slice(0, endIdx).trim();
	const maxLen = 64;
	const base = first.length > 8 ? first : cleaned;
	const truncated =
		base.length > maxLen ? `${base.slice(0, maxLen - 1).trimEnd()}…` : base;
	return truncated;
}

function sanitizeTitle(s: string): string {
	let t = s.trim();
	// Strip surrounding quotes and trailing punctuation
	t = t.replace(/^['"“”‘’()[\]]+|['"“”‘’()[\]]+$/g, '').trim();
	t = t.replace(/[\s\-_:–—]+$/g, '').trim();
	// Limit length
	if (t.length > 64) t = `${t.slice(0, 63).trimEnd()}…`;
	return t;
}
