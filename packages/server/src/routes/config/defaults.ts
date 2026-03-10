import type { Hono } from 'hono';
import {
	setConfig,
	loadConfig,
	type ProviderId,
	type ReasoningLevel,
} from '@ottocode/sdk';
import { logger } from '@ottocode/sdk';
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
				guidedMode?: boolean;
				reasoningText?: boolean;
				reasoningLevel?: ReasoningLevel;
				theme?: string;
				scope?: 'global' | 'local';
			}>();

			const scope = body.scope || 'global';
			const updates: Partial<{
				agent: string;
				provider: ProviderId;
				model: string;
				toolApproval: 'auto' | 'dangerous' | 'all';
				guidedMode: boolean;
				reasoningText: boolean;
				reasoningLevel: ReasoningLevel;
				theme: string;
			}> = {};

			if (body.agent) updates.agent = body.agent;
			if (body.provider) updates.provider = body.provider as ProviderId;
			if (body.model) updates.model = body.model;
			if (body.toolApproval) updates.toolApproval = body.toolApproval;
			if (body.guidedMode !== undefined) updates.guidedMode = body.guidedMode;
			if (body.reasoningText !== undefined)
				updates.reasoningText = body.reasoningText;
			if (body.reasoningLevel) updates.reasoningLevel = body.reasoningLevel;
			if (body.theme) updates.theme = body.theme;

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
