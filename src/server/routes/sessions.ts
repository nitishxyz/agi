import type { Hono } from 'hono';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { sessions } from '@/db/schema/index.ts';
import { validateProviderModel } from '@/providers/validate.ts';
import { publish } from '@/server/events/bus.ts';
import { desc, eq } from 'drizzle-orm';
import {
	isProviderAuthorized,
	ensureProviderEnv,
} from '@/providers/authorization.ts';
import type { ProviderId } from '@/auth/index.ts';
const providerValues = [
	'openai',
	'anthropic',
	'google',
	'openrouter',
	'opencode',
] as const;
function isProviderId(value: string): value is ProviderId {
	return (providerValues as readonly string[]).includes(value);
}

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
		const id = crypto.randomUUID();
		const now = Date.now();
		const providerCandidate =
			typeof body.provider === 'string' ? body.provider : undefined;
		const provider: ProviderId =
			providerCandidate && isProviderId(providerCandidate)
				? providerCandidate
				: cfg.defaults.provider;
		const row = {
			id,
			title: (body.title as string | null | undefined) ?? null,
			agent: (body.agent as string | undefined) ?? cfg.defaults.agent,
			provider,
			model: (body.model as string | undefined) ?? cfg.defaults.model,
			projectPath: cfg.projectRoot,
			createdAt: now,
		};
		try {
			validateProviderModel(row.provider, row.model);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json({ error: message }, 400);
		}
		// Enforce provider auth
		const authorized = await isProviderAuthorized(cfg, row.provider);
		if (!authorized) {
			return c.json(
				{
					error: `Provider ${row.provider} is not configured. Run \`agi auth login\` to add credentials.`,
				},
				400,
			);
		}
		await ensureProviderEnv(cfg, row.provider);
		await db.insert(sessions).values(row);
		// keep response shape aligned with GET
		publish({ type: 'session.created', sessionId: id, payload: row });
		return c.json(row, 201);
	});
}
