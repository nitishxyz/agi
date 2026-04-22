import type { Hono } from 'hono';
import {
	loadConfig,
	removeProviderSettings,
	writeProviderSettings,
	isBuiltInProviderId,
	type ProviderCompatibility,
	type ProviderPromptFamily,
	type ProviderId,
	type ProviderSettingsEntry,
} from '@ottocode/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { logger } from '@ottocode/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';
import {
	getAuthorizedProviders,
	getDefault,
	getProviderDetails,
} from './utils.ts';

type ProviderMutationBody = {
	enabled?: boolean;
	custom?: boolean;
	label?: string;
	compatibility?: ProviderCompatibility;
	family?: ProviderPromptFamily;
	baseURL?: string | null;
	apiKey?: string | null;
	apiKeyEnv?: string | null;
	models?: string[];
	allowAnyModel?: boolean;
	scope?: 'global' | 'local';
};

export function registerProvidersRoute(app: Hono) {
	app.get('/v1/config/providers', async (c) => {
		try {
			const embeddedConfig = (
				c as unknown as {
					get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
				}
			).get('embeddedConfig');

			if (embeddedConfig && Object.keys(embeddedConfig).length > 0) {
				const providers = embeddedConfig.auth
					? (Object.keys(embeddedConfig.auth) as ProviderId[])
					: embeddedConfig.provider
						? [embeddedConfig.provider]
						: [];

				return c.json({
					providers,
					details: providers.map((provider) => ({
						id: provider,
						label: provider,
						source: 'built-in',
						enabled: true,
						authorized: true,
						custom: false,
						hasApiKey: false,
						allowAnyModel: false,
						modelCount: 0,
					})),
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
			const details = await getProviderDetails(undefined, cfg);

			return c.json({
				providers: authorizedProviders,
				details,
				default: cfg.defaults.provider,
			});
		} catch (error) {
			logger.error('Failed to get providers', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.put('/v1/config/providers/:provider', async (c) => {
		try {
			const embeddedConfig = (
				c as unknown as {
					get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
				}
			).get('embeddedConfig');
			if (embeddedConfig && Object.keys(embeddedConfig).length > 0) {
				return c.json({ error: 'Embedded config cannot be modified' }, 400);
			}

			const projectRoot = c.req.query('project') || process.cwd();
			const provider = c.req.param('provider').trim();
			const body = await c.req.json<ProviderMutationBody>();
			const scope = body.scope || 'local';
			if (!provider) return c.json({ error: 'Provider is required' }, 400);

			const updates: ProviderSettingsEntry = {
				enabled: body.enabled ?? true,
				custom: isBuiltInProviderId(provider)
					? body.custom
					: (body.custom ?? true),
			};

			if (body.label !== undefined)
				updates.label = body.label.trim() || undefined;
			if (body.compatibility !== undefined) {
				updates.compatibility = body.compatibility;
			}
			if (body.family !== undefined) updates.family = body.family;
			if (body.baseURL !== undefined) {
				updates.baseURL = body.baseURL?.trim() || undefined;
			}
			if (body.apiKey !== undefined)
				updates.apiKey = body.apiKey?.trim() || undefined;
			if (body.apiKeyEnv !== undefined) {
				updates.apiKeyEnv = body.apiKeyEnv?.trim() || undefined;
			}
			if (body.models !== undefined) {
				updates.models = body.models
					.map((model) => model.trim())
					.filter(Boolean);
			}
			if (body.allowAnyModel !== undefined) {
				updates.allowAnyModel = body.allowAnyModel;
			}

			if (!isBuiltInProviderId(provider) && !updates.compatibility) {
				return c.json({ error: 'Custom providers require compatibility' }, 400);
			}

			await writeProviderSettings(scope, provider, updates, projectRoot);
			const cfg = await loadConfig(projectRoot);
			const details = await getProviderDetails(undefined, cfg);
			return c.json({
				success: true,
				provider,
				details,
			});
		} catch (error) {
			logger.error('Failed to update provider settings', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.delete('/v1/config/providers/:provider', async (c) => {
		try {
			const embeddedConfig = (
				c as unknown as {
					get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
				}
			).get('embeddedConfig');
			if (embeddedConfig && Object.keys(embeddedConfig).length > 0) {
				return c.json({ error: 'Embedded config cannot be modified' }, 400);
			}

			const projectRoot = c.req.query('project') || process.cwd();
			const provider = c.req.param('provider').trim();
			const scope =
				(c.req.query('scope') as 'global' | 'local' | undefined) || 'local';
			if (!provider) return c.json({ error: 'Provider is required' }, 400);

			await removeProviderSettings(scope, provider, projectRoot);
			const cfg = await loadConfig(projectRoot);
			const details = await getProviderDetails(undefined, cfg);
			return c.json({ success: true, provider, details });
		} catch (error) {
			logger.error('Failed to remove provider settings', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
