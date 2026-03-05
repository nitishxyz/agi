import type { Hono } from 'hono';
import {
	loadConfig,
	catalog,
	getAuth,
	logger,
	readEnvKey,
	type ProviderId,
	filterModelsForAuthType,
} from '@ottocode/sdk';
import type { EmbeddedAppConfig } from '../../index.ts';
import { serializeError } from '../../runtime/errors/api-error.ts';
import {
	isProviderAuthorizedHybrid,
	getAuthorizedProviders,
	getDefault,
	getAuthTypeForProvider,
} from './utils.ts';

const COPILOT_MODELS_URL = 'https://api.githubcopilot.com/models';

function filterCopilotAvailability<
	T extends { id: string },
>(
	provider: ProviderId,
	models: T[],
	copilotAllowedModels: Set<string> | null,
): T[] {
	if (provider !== 'copilot') return models;
	if (!copilotAllowedModels || copilotAllowedModels.size === 0) return models;
	return models.filter((m) => copilotAllowedModels.has(m.id));
}

async function getCopilotAuthTokens(projectRoot: string): Promise<string[]> {
	const tokens: string[] = [];

	const envToken = readEnvKey('copilot');
	if (envToken) tokens.push(envToken);

	const auth = await getAuth('copilot', projectRoot);
	if (auth?.type === 'oauth' && auth.refresh) {
		if (auth.refresh !== envToken) {
			tokens.push(auth.refresh);
		}
	}

	return tokens;
}

async function getAuthorizedCopilotModels(
	projectRoot: string,
): Promise<Set<string> | null> {
	const tokens = await getCopilotAuthTokens(projectRoot);
	if (!tokens.length) return null;

	const merged = new Set<string>();
	let successful = false;

	for (const token of tokens) {
		try {
			const response = await fetch(COPILOT_MODELS_URL, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Openai-Intent': 'conversation-edits',
					'User-Agent': 'ottocode',
				},
			});
			if (!response.ok) continue;

			successful = true;
			const payload = (await response.json()) as {
				data?: Array<{ id?: string }>;
			};

			for (const id of (payload.data ?? []).map((item) => item.id)) {
				if (id) merged.add(id);
			}
		} catch {}
	}

	return successful ? merged : null;
}

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

			const authType = await getAuthTypeForProvider(
				embeddedConfig,
				provider,
				projectRoot,
			);
			const filteredModels = filterModelsForAuthType(
				provider,
				providerCatalog.models,
				authType,
			);
			const copilotAllowedModels =
				provider === 'copilot'
					? await getAuthorizedCopilotModels(projectRoot)
					: null;

			const availableModels = filterCopilotAvailability(
				provider,
				filteredModels,
				copilotAllowedModels,
			);

			return c.json({
				models: availableModels.map((m) => ({
					id: m.id,
					label: m.label || m.id,
					toolCall: m.toolCall,
					reasoningText: m.reasoningText,
					vision: m.modalities?.input?.includes('image') ?? false,
					attachment: m.attachment ?? false,
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
					authType?: 'api' | 'oauth' | 'wallet';
					models: Array<{
						id: string;
						label: string;
						toolCall?: boolean;
						reasoningText?: boolean;
					}>;
				}
			> = {};

			for (const provider of authorizedProviders) {
				const providerCatalog = catalog[provider];
				if (providerCatalog) {
					const authType = await getAuthTypeForProvider(
						embeddedConfig,
						provider,
						projectRoot,
					);
					const filteredModels = filterModelsForAuthType(
						provider,
						providerCatalog.models,
						authType,
					);
					const copilotAllowedModels =
						provider === 'copilot'
							? await getAuthorizedCopilotModels(projectRoot)
							: null;
				const availableModels = filterCopilotAvailability(
					provider,
					filteredModels,
					copilotAllowedModels,
				);
					modelsMap[provider] = {
						label: providerCatalog.label || provider,
						authType,
					models: availableModels.map((m) => ({
							id: m.id,
							label: m.label || m.id,
							toolCall: m.toolCall,
							reasoningText: m.reasoningText,
							vision: m.modalities?.input?.includes('image') ?? false,
							attachment: m.attachment ?? false,
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
