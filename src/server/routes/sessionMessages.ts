import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { messages, messageParts, sessions } from '@/db/schema/index.ts';
import { eq, inArray } from 'drizzle-orm';
import { validateProviderModel } from '@/providers/validate.ts';
import { isProviderAuthorized, ensureProviderEnv } from '@/providers/authorization.ts';
import { publish } from '@/server/events/bus.ts';
import { enqueueAssistantRun } from '@/server/runtime/runner.ts';

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
        ? await db.select().from(messageParts).where(inArray(messageParts.messageId, ids))
        : [];
      const partsByMsg = new Map<string, any[]>();
      for (const p of parts) {
        const arr = partsByMsg.get(p.messageId) ?? [];
        arr.push(p);
        partsByMsg.set(p.messageId, arr);
      }
      const enriched = rows.map((m) => ({ ...m, parts: (partsByMsg.get(m.id) ?? []).sort((a, b) => a.index - b.index) }));
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
    const sessionRows = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!sessionRows.length) return c.json({ error: 'Session not found' }, 404);
    const sess = sessionRows[0] as any;
    const provider = body?.provider ?? sess.provider ?? cfg.defaults.provider;
    const modelName = body?.model ?? sess.model ?? cfg.defaults.model;
    const agent = body?.agent ?? sess.agent ?? cfg.defaults.agent;
		const content = body?.content ?? '';

    // Validate model capabilities if tools are allowed for this agent
    const wantsToolCalls = true; // agent toolset may be non-empty
    try {
      validateProviderModel(provider, modelName, { wantsToolCalls });
    } catch (err: any) {
      return c.json({ error: String(err?.message ?? err) }, 400);
    }
    // Enforce provider auth: only allow providers/models the user authenticated for
    const authorized = await isProviderAuthorized(cfg, provider);
    if (!authorized) {
      return c.json({ error: `Provider ${provider} is not configured. Run \`agi auth login\` to add credentials.` }, 400);
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
    publish({ type: 'message.created', sessionId, payload: { id: userMessageId, role: 'user' } });

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
    publish({ type: 'message.created', sessionId, payload: { id: assistantMessageId, role: 'assistant' } });

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
      await db.update(sessions).set({ lastActiveAt: Date.now() }).where(eq(sessions.id, sessionId));
    } catch {}

    return c.json({ messageId: assistantMessageId }, 202);
  });
}
