import type { Hono } from 'hono';
import { setConfig, loadConfig } from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';

export function registerDefaultsRoute(app: Hono) {
	app.patch('/v1/config/defaults', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const body = await c.req.json<{
				agent?: string;
				provider?: string;
				model?: string;
				toolApproval?: 'auto' | 'dangerous' | 'all';
				scope?: 'global' | 'local';
			}>();

			const scope = body.scope || 'local';
			const updates: Partial<{
				agent: string;
				provider: string;
				model: string;
				toolApproval: 'auto' | 'dangerous' | 'all';
			}> = {};

			if (body.agent) updates.agent = body.agent;
			if (body.provider) updates.provider = body.provider;
			if (body.model) updates.model = body.model;
			if (body.toolApproval) updates.toolApproval = body.toolApproval;

			await setConfig(scope, updates, projectRoot);

			const cfg = await loadConfig(projectRoot);

			return c.json({
				success: true,
				defaults: cfg.defaults,
			});
		} catch (error) {
			logger.error('Failed to update defaults', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
