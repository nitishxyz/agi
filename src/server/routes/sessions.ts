import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { sessions } from '@/db/schema/index.ts';
import { desc, eq } from 'drizzle-orm';
import type { ProviderId } from '@/providers/catalog.ts';
import { isProviderId } from '@/providers/utils.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { createSession as createSessionRow } from '@/server/runtime/sessionManager.ts';

export function registerSessionsRoutes(app: Hono) {
	// List sessions
	app.get('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		// Only return sessions for this project
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.projectPath, cfg.projectRoot))
			.orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt));
		const normalized = rows.map((r) => {
			let counts: Record<string, unknown> | undefined;
			if (r.toolCountsJson) {
				try {
					const parsed = JSON.parse(r.toolCountsJson);
					if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
						counts = parsed as Record<string, unknown>;
					}
				} catch {}
			}
			const { toolCountsJson: _toolCountsJson, ...rest } = r;
			return counts ? { ...rest, toolCounts: counts } : rest;
		});
		return c.json(normalized);
	});

	// Create session
	app.post('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const body = (await c.req.json().catch(() => ({}))) as Record<
			string,
			unknown
		>;
		const agent = (body.agent as string | undefined) ?? cfg.defaults.agent;
		const agentCfg = await resolveAgentConfig(cfg.projectRoot, agent);
		const providerCandidate =
			typeof body.provider === 'string' ? body.provider : undefined;
		const provider: ProviderId = (() => {
			if (providerCandidate && isProviderId(providerCandidate))
				return providerCandidate;
			if (agentCfg.provider && isProviderId(agentCfg.provider))
				return agentCfg.provider;
			return cfg.defaults.provider;
		})();
		const modelCandidate =
			typeof body.model === 'string' ? body.model.trim() : undefined;
		const model = modelCandidate?.length
			? modelCandidate
			: (agentCfg.model ?? cfg.defaults.model);
		try {
			const row = await createSessionRow({
				db,
				cfg,
				agent,
				provider,
				model,
				title: (body.title as string | null | undefined) ?? null,
			});
			return c.json(row, 201);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json({ error: message }, 400);
		}
	});
}
