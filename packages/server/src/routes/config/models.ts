import type { Hono } from 'hono';
import { loadConfig, catalog, type ProviderId } from '@agi-cli/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { logger } from '@agi-cli/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';
import {
	isProviderAuthorizedHybrid,
	getAuthorizedProviders,
	getDefault,
} from './utils.ts';

export function registerModelsRoutes(app: Hono) {
	app.get('/v1/config/providers/:provider/models', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;
			const provider = c.req.param('provider') as ProviderId;

			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			const authorized = await isProviderAuthorizedHybrid(
				embeddedConfig,
				cfg,
				provider,
			);

			if (!authorized) {
				logger.warn('Provider not authorized', { provider });
				return c.json({ error: 'Provider not authorized' }, 403);
			}

			const providerCatalog = catalog[provider];
			if (!providerCatalog) {
				logger.warn('Provider not found in catalog', { provider });
				return c.json({ error: 'Provider not found' }, 404);
			}

			return c.json({
				models: providerCatalog.models.map((m) => ({
					id: m.id,
					label: m.label || m.id,
					toolCall: m.toolCall,
					reasoning: m.reasoning,
					vision: m.modalities?.input?.includes('image') ?? false,
				})),
				default: getDefault(
					embeddedConfig?.model,
					embeddedConfig?.defaults?.model,
					cfg.defaults.model,
				),
			});
		} catch (error) {
			logger.error('Failed to get provider models', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/config/models', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			const authorizedProviders = await getAuthorizedProviders(
				embeddedConfig,
				cfg,
			);

			const modelsMap: Record<
				string,
				{
					label: string;
					models: Array<{
						id: string;
						label: string;
						toolCall?: boolean;
						reasoning?: boolean;
					}>;
				}
			> = {};

			for (const provider of authorizedProviders) {
				const providerCatalog = catalog[provider];
				if (providerCatalog) {
					modelsMap[provider] = {
						label: providerCatalog.label || provider,
						models: providerCatalog.models.map((m) => ({
							id: m.id,
							label: m.label || m.id,
							toolCall: m.toolCall,
							reasoning: m.reasoning,
							vision: m.modalities?.input?.includes('image') ?? false,
						})),
					};
				}
			}

			return c.json(modelsMap);
		} catch (error) {
			logger.error('Failed to get all models', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
