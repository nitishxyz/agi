import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { sessions } from '@/db/schema/index.ts';
import { validateProviderModel } from '@/providers/validate.ts';
import { publish } from '@/server/events/bus.ts';
import { desc } from 'drizzle-orm';
import {
	isProviderAuthorized,
	ensureProviderEnv,
} from '@/providers/authorization.ts';

export function registerSessionsRoutes(app: Hono) {
	// List sessions
	app.get('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const rows = await db
			.select()
			.from(sessions)
			.orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt));
		const normalized = rows.map((r: any) => {
			let counts: any;
			try {
				counts = r.toolCountsJson ? JSON.parse(r.toolCountsJson) : undefined;
			} catch {}
			const { toolCountsJson, ...rest } = r;
			return counts ? { ...rest, toolCounts: counts } : rest;
		});
		return c.json(normalized);
	});

	// Create session
	app.post('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const body = await c.req.json().catch(() => ({}));
		const id = crypto.randomUUID();
		const now = Date.now();
		const row = {
			id,
			title: body?.title ?? null,
			agent: body?.agent ?? cfg.defaults.agent,
			provider: body?.provider ?? cfg.defaults.provider,
			model: body?.model ?? cfg.defaults.model,
			projectPath: cfg.projectRoot,
			createdAt: now,
		};
		try {
			validateProviderModel(row.provider, row.model);
		} catch (err: any) {
			return c.json({ error: String(err?.message ?? err) }, 400);
		}
		// Enforce provider auth
		const authorized = await isProviderAuthorized(cfg, row.provider as any);
		if (!authorized) {
			return c.json(
				{
					error: `Provider ${row.provider} is not configured. Run \`agi auth login\` to add credentials.`,
				},
				400,
			);
		}
		await ensureProviderEnv(cfg, row.provider as any);
		await db.insert(sessions).values(row);
		const response = { ...row } as any;
		// keep response shape aligned with GET
		publish({ type: 'session.created', sessionId: id, payload: response });
		return c.json(response, 201);
	});
}
