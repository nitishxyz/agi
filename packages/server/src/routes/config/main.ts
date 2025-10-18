import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { logger } from '@agi-cli/sdk';
import { serializeError } from '../../runtime/api-error.ts';
import {
	discoverAllAgents,
	getAuthorizedProviders,
	getDefault,
} from './utils.ts';

export function registerMainConfigRoute(app: Hono) {
	app.get('/v1/config', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			const cfg = await loadConfig(projectRoot);

			let allAgents: string[];

			if (embeddedConfig?.agents) {
				const embeddedAgents = Object.keys(embeddedConfig.agents);
				const fileAgents = await discoverAllAgents(cfg.projectRoot);
				allAgents = Array.from(
					new Set([...embeddedAgents, ...fileAgents]),
				).sort();
			} else {
				allAgents = await discoverAllAgents(cfg.projectRoot);
			}

			const authorizedProviders = await getAuthorizedProviders(
				embeddedConfig,
				cfg,
			);

			const defaults = {
				agent: getDefault(
					embeddedConfig?.agent,
					embeddedConfig?.defaults?.agent,
					cfg.defaults.agent,
				),
				provider: getDefault(
					embeddedConfig?.provider,
					embeddedConfig?.defaults?.provider,
					cfg.defaults.provider,
				),
				model: getDefault(
					embeddedConfig?.model,
					embeddedConfig?.defaults?.model,
					cfg.defaults.model,
				),
			};

			return c.json({
				agents: allAgents,
				providers: authorizedProviders,
				defaults,
			});
		} catch (error) {
			logger.error('Failed to load config', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
