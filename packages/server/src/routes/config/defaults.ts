import type { Hono } from 'hono';
import {
	setConfig,
	loadConfig,
	hasConfiguredProvider,
	type ProviderId,
	type ReasoningLevel,
} from '@ottocode/sdk';
import { logger } from '@ottocode/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';

export function registerDefaultsRoute(app: Hono) {
	app.patch('/v1/config/defaults', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const body = await c.req.json<{
				agent?: string;
				provider?: string;
				model?: string;
				toolApproval?: 'auto' | 'dangerous' | 'all' | 'yolo';
				guidedMode?: boolean;
				reasoningText?: boolean;
				reasoningLevel?: ReasoningLevel;
				theme?: string;
				fullWidthContent?: boolean;
				autoCompactThresholdTokens?: number | null;
				scope?: 'global' | 'local';
			}>();

			const scope = body.scope || 'global';
			const updates: Partial<{
				agent: string;
				provider: ProviderId;
				model: string;
				toolApproval: 'auto' | 'dangerous' | 'all' | 'yolo';
				guidedMode: boolean;
				reasoningText: boolean;
				reasoningLevel: ReasoningLevel;
				theme: string;
				fullWidthContent: boolean;
				autoCompactThresholdTokens: number | null;
			}> = {};

			if (body.agent) updates.agent = body.agent;
			if (body.provider) {
				if (!hasConfiguredProvider(cfg, body.provider)) {
					return c.json({ error: `Invalid provider: ${body.provider}` }, 400);
				}
				updates.provider = body.provider as ProviderId;
			}
			if (body.model) updates.model = body.model;
			if (body.toolApproval) updates.toolApproval = body.toolApproval;
			if (body.guidedMode !== undefined) updates.guidedMode = body.guidedMode;
			if (body.reasoningText !== undefined)
				updates.reasoningText = body.reasoningText;
			if (body.reasoningLevel) updates.reasoningLevel = body.reasoningLevel;
			if (body.theme) updates.theme = body.theme;
			if (body.fullWidthContent !== undefined)
				updates.fullWidthContent = body.fullWidthContent;
			if (body.autoCompactThresholdTokens !== undefined) {
				const threshold = body.autoCompactThresholdTokens;
				if (threshold === null) {
					updates.autoCompactThresholdTokens = null;
				} else if (Number.isFinite(threshold) && threshold > 0) {
					updates.autoCompactThresholdTokens = Math.floor(threshold);
				}
			}

			await setConfig(scope, updates, projectRoot);

			const nextCfg = await loadConfig(projectRoot);

			return c.json({
				success: true,
				defaults: nextCfg.defaults,
			});
		} catch (error) {
			logger.error('Failed to update defaults', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
