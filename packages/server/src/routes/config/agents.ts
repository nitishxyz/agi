import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { logger } from '../../runtime/logger.ts';
import { serializeError } from '../../runtime/api-error.ts';
import { discoverAllAgents, getDefault } from './utils.ts';

export function registerAgentsRoute(app: Hono) {
	app.get('/v1/config/agents', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			if (embeddedConfig) {
				const agents = embeddedConfig.agents
					? Object.keys(embeddedConfig.agents)
					: ['general', 'build', 'plan'];
				return c.json({
					agents,
					default: getDefault(
						embeddedConfig.agent,
						embeddedConfig.defaults?.agent,
						'general',
					),
				});
			}

			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			const allAgents = await discoverAllAgents(cfg.projectRoot);

			return c.json({
				agents: allAgents,
				default: cfg.defaults.agent,
			});
		} catch (error) {
			logger.error('Failed to get agents', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
