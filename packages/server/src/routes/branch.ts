import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { isProviderId, logger } from '@agi-cli/sdk';
import {
	createBranch,
	listBranches,
	getParentSession,
} from '../runtime/session/branch.ts';
import { serializeError } from '../runtime/errors/api-error.ts';

export function registerBranchRoutes(app: Hono) {
	app.post('/v1/sessions/:sessionId/branch', async (c) => {
		try {
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const body = (await c.req.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;

			const fromMessageId = body.fromMessageId;
			if (typeof fromMessageId !== 'string' || !fromMessageId.trim()) {
				return c.json({ error: 'fromMessageId is required' }, 400);
			}

			const provider =
				typeof body.provider === 'string' && isProviderId(body.provider)
					? body.provider
					: undefined;

			const model =
				typeof body.model === 'string' && body.model.trim()
					? body.model.trim()
					: undefined;

			const agent =
				typeof body.agent === 'string' && body.agent.trim()
					? body.agent.trim()
					: undefined;

			const title =
				typeof body.title === 'string' && body.title.trim()
					? body.title.trim()
					: undefined;

			const result = await createBranch({
				db,
				parentSessionId: sessionId,
				fromMessageId: fromMessageId.trim(),
				provider,
				model,
				agent,
				title,
				projectPath: cfg.projectRoot,
			});

			return c.json(result, 201);
		} catch (err) {
			logger.error('Failed to create branch', err);
			const errorResponse = serializeError(err);
			return c.json(errorResponse, errorResponse.error.status || 400);
		}
	});

	app.get('/v1/sessions/:sessionId/branches', async (c) => {
		try {
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const branches = await listBranches(db, sessionId, cfg.projectRoot);

			return c.json({ branches });
		} catch (err) {
			logger.error('Failed to list branches', err);
			const errorResponse = serializeError(err);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/sessions/:sessionId/parent', async (c) => {
		try {
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const parent = await getParentSession(db, sessionId, cfg.projectRoot);

			if (!parent) {
				return c.json({ parent: null });
			}

			return c.json({ parent });
		} catch (err) {
			logger.error('Failed to get parent session', err);
			const errorResponse = serializeError(err);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
