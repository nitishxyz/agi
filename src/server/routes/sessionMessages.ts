import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { messages, messageParts } from '@/db/schema/index.ts';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { resolveModel } from '@/ai/provider.ts';
import { defaultAgentPrompts } from '@/ai/agents/defaults.ts';

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
		return c.json(rows);
	});

	// Post a user message and get assistant reply (non-streaming for v0)
	app.post('/v1/sessions/:id/messages', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const sessionId = c.req.param('id');
		const body = await c.req.json().catch(() => ({}));
		const provider = body?.provider ?? cfg.defaults.provider;
		const modelName = body?.model ?? cfg.defaults.model;
		const agent = body?.agent ?? cfg.defaults.agent;
		const content = body?.content ?? '';

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

		const system = defaultAgentPrompts[agent] ?? 'You are a helpful assistant.';
		const model = resolveModel(provider, modelName, cfg);
		const { text: assistantText } = await generateText({
			model,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: String(content) },
			],
		});

		const assistantMessageId = crypto.randomUUID();
		await db.insert(messages).values({
			id: assistantMessageId,
			sessionId,
			role: 'assistant',
			status: 'complete',
			agent,
			provider,
			model: modelName,
			createdAt: Date.now(),
		});
		await db.insert(messageParts).values({
			id: crypto.randomUUID(),
			messageId: assistantMessageId,
			index: 0,
			type: 'text',
			content: JSON.stringify({ text: assistantText }),
			agent,
			provider,
			model: modelName,
		});

		return c.json({ messageId: assistantMessageId, text: assistantText });
	});
}
