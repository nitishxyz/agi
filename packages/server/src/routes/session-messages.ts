import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { eq, inArray } from 'drizzle-orm';
import {
	validateProviderModel,
	isProviderAuthorized,
	ensureProviderEnv,
} from '@agi-cli/sdk';
import { dispatchAssistantMessage } from '../runtime/message-service.ts';
import { logger } from '../runtime/logger.ts';
import { serializeError } from '../runtime/api-error.ts';

type MessagePartRow = typeof messageParts.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

export function registerSessionMessagesRoutes(app: Hono) {
	// List messages for a session
	app.get('/v1/sessions/:id/messages', async (c) => {
		try {
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
				const wantParsed = (() => {
					const q = (c.req.query('parsed') || '').toLowerCase();
					return q === '1' || q === 'true' || q === 'yes';
				})();
				function parseContent(raw: string): Record<string, unknown> | string {
					try {
						const v = JSON.parse(String(raw ?? ''));
						if (v && typeof v === 'object' && !Array.isArray(v))
							return v as Record<string, unknown>;
					} catch {}
					return raw;
				}
				const enriched = rows.map((m) => {
					const parts = (partsByMsg.get(m.id) ?? []).sort(
						(a, b) => a.index - b.index,
					);
					const mapped = parts.map((p) => {
						const parsed = parseContent(p.content);
						return wantParsed
							? { ...p, content: parsed }
							: { ...p, contentJson: parsed };
					});
					return { ...m, parts: mapped };
				});
				return c.json(enriched);
			}
			return c.json(rows);
		} catch (error) {
			logger.error('Failed to list session messages', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	// Post a user message and get assistant reply (non-streaming for v0)
	app.post('/v1/sessions/:id/messages', async (c) => {
		try {
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
			if (!sessionRows.length) {
				logger.warn('Session not found', { sessionId });
				return c.json({ error: 'Session not found' }, 404);
			}
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
				logger.error('Model validation failed', err, { provider, modelName });
				const message = err instanceof Error ? err.message : String(err);
				return c.json({ error: message }, 400);
			}
			// Enforce provider auth: only allow providers/models the user authenticated for
			const authorized = await isProviderAuthorized(cfg, provider);
			if (!authorized) {
				logger.warn('Provider not authorized', { provider });
				return c.json(
					{
						error: `Provider ${provider} is not configured. Run \`agi auth login\` to add credentials.`,
					},
					400,
				);
			}
			await ensureProviderEnv(cfg, provider);

			const { assistantMessageId } = await dispatchAssistantMessage({
				cfg,
				db,
				session: sess,
				agent,
				provider,
				model: modelName,
				content,
				oneShot: Boolean(body?.oneShot),
			});
			return c.json({ messageId: assistantMessageId }, 202);
		} catch (error) {
			logger.error('Failed to create session message', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
