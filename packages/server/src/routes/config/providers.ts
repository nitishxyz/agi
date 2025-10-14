import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import type { ProviderId } from '@agi-cli/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { logger } from '../../runtime/logger.ts';
import { serializeError } from '../../runtime/api-error.ts';
import { getAuthorizedProviders, getDefault } from './utils.ts';

export function registerProvidersRoute(app: Hono) {
	app.get('/v1/config/providers', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			if (embeddedConfig) {
				const providers = embeddedConfig.auth
					? (Object.keys(embeddedConfig.auth) as ProviderId[])
					: [embeddedConfig.provider];

				return c.json({
					providers,
					default: getDefault(
						embeddedConfig.provider,
						embeddedConfig.defaults?.provider,
						undefined,
					),
				});
			}

			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			const authorizedProviders = await getAuthorizedProviders(undefined, cfg);

			return c.json({
				providers: authorizedProviders,
				default: cfg.defaults.provider,
			});
		} catch (error) {
			logger.error('Failed to get providers', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
