import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { sessions } from '@/db/schema/index.ts';
import { desc } from 'drizzle-orm';

export function registerSessionsRoutes(app: Hono) {
	// List sessions
	app.get('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const rows = await db
			.select()
			.from(sessions)
			.orderBy(desc(sessions.createdAt));
		return c.json(rows);
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
		await db.insert(sessions).values(row);
		return c.json(row, 201);
	});
}
