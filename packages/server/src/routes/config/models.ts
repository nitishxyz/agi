import type { Hono } from 'hono';
import {
	discoverOllamaModels,
	loadConfig,
	catalog,
	getConfiguredProviderModels,
	getProviderDefinition,
	providerAllowsAnyModel,
	getAuth,
	logger,
	readEnvKey,
	type ModelInfo,
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

function filterCopilotAvailability<T extends { id: string }>(
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

async function discoverProviderModels(args: {
	provider: ProviderId;
	providerDefinition: NonNullable<ReturnType<typeof getProviderDefinition>>;
	projectRoot: string;
}): Promise<ModelInfo[] | null> {
	const { provider, providerDefinition, projectRoot } = args;
	if (
		providerDefinition.compatibility !== 'ollama' ||
		!providerDefinition.baseURL
	) {
		return null;
	}

	try {
		const auth = await getAuth(provider, projectRoot);
		const apiKey =
			auth?.type === 'api'
				? auth.key
				: (readEnvKey(provider) ?? providerDefinition.apiKey);
		const discovered = await discoverOllamaModels({
			baseURL: providerDefinition.baseURL,
			apiKey,
		});
		return discovered.models;
	} catch (error) {
		logger.warn('Failed to discover Ollama models', {
			provider,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export function registerModelsRoutes(app: Hono) {
	app.get('/v1/config/providers/:provider/models', async (c) => {
		try {
			const embeddedConfig = (
				c as unknown as {
					get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
				}
			).get('embeddedConfig');
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

			const providerCatalog = catalog[provider as keyof typeof catalog];
			const providerDefinition = getProviderDefinition(cfg, provider);
			if (!providerDefinition) {
				logger.warn('Provider not found in catalog', { provider });
				return c.json({ error: 'Provider not found' }, 404);
			}

			const authType = await getAuthTypeForProvider(
				embeddedConfig,
				provider,
				projectRoot,
			);
			const discoveredModels = await discoverProviderModels({
				provider,
				providerDefinition,
				projectRoot,
			});
			const filteredModels =
				discoveredModels ??
				(providerCatalog
					? filterModelsForAuthType(provider, providerCatalog.models, authType)
					: getConfiguredProviderModels(cfg, provider));
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
					free: m.cost?.input === 0 && m.cost?.output === 0,
				})),
				default: getDefault(
					embeddedConfig?.model,
					embeddedConfig?.defaults?.model,
					cfg.defaults.model,
				),
				allowAnyModel: providerAllowsAnyModel(cfg, provider),
				label: providerDefinition.label,
			});
		} catch (error) {
			logger.error('Failed to get provider models', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/config/models', async (c) => {
		try {
			const embeddedConfig = (
				c as unknown as {
					get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
				}
			).get('embeddedConfig');

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
				const providerCatalog = catalog[provider as keyof typeof catalog];
				const providerDefinition = getProviderDefinition(cfg, provider);
				if (providerDefinition) {
					const authType = await getAuthTypeForProvider(
						embeddedConfig,
						provider,
						projectRoot,
					);
					const discoveredModels = await discoverProviderModels({
						provider,
						providerDefinition,
						projectRoot,
					});
					const filteredModels =
						discoveredModels ??
						(providerCatalog
							? filterModelsForAuthType(
									provider,
									providerCatalog.models,
									authType,
								)
							: getConfiguredProviderModels(cfg, provider));
					modelsMap[provider] = {
						label: providerDefinition.label,
						authType,
						models: filteredModels.map((m) => ({
							id: m.id,
							label: m.label || m.id,
							toolCall: m.toolCall,
							reasoningText: m.reasoningText,
							vision: m.modalities?.input?.includes('image') ?? false,
							attachment: m.attachment ?? false,
							free: m.cost?.input === 0 && m.cost?.output === 0,
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
