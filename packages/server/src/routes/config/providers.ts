import type { Hono } from 'hono';
import {
	loadConfig,
	removeProviderSettings,
	writeProviderSettings,
	discoverOllamaModels,
	isBuiltInProviderId,
	type ModelInfo,
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
import { openApiRoute } from '../../openapi/route.ts';

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
};

type ProviderDiscoveryBody = {
	compatibility?: ProviderCompatibility;
	baseURL?: string;
	apiKey?: string;
};

function toDiscoveredModel(model: ModelInfo) {
	return {
		id: model.id,
		label: model.label || model.id,
		toolCall: model.toolCall,
		reasoningText: model.reasoningText,
		vision: model.modalities?.input?.includes('image') ?? false,
		attachment: model.attachment ?? false,
		contextWindow: model.limit?.context,
		maxOutputTokens: model.limit?.output,
	};
}

export function registerProvidersRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/config/providers',
			tags: ['config'],
			operationId: 'getProviders',
			summary: 'Get available providers',
			description: 'Returns only providers that have been authorized',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									providers: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/Provider',
										},
									},
									details: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/ProviderDetail',
										},
									},
									default: {
										$ref: '#/components/schemas/Provider',
									},
								},
								required: ['providers', 'details', 'default'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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

				const authorizedProviders = await getAuthorizedProviders(
					undefined,
					cfg,
				);
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
		},
	);

	openApiRoute(
		app,
		'post',
		'/v1/config/providers/discover-models',
		async (c) => {
			try {
				const embeddedConfig = (
					c as unknown as {
						get: (key: 'embeddedConfig') => EmbeddedAppConfig | undefined;
					}
				).get('embeddedConfig');
				if (embeddedConfig && Object.keys(embeddedConfig).length > 0) {
					return c.json({ error: 'Embedded config cannot be modified' }, 400);
				}

				const body = await c.req.json<ProviderDiscoveryBody>();
				const compatibility = body.compatibility || 'openai-compatible';
				const baseURL = body.baseURL?.trim();
				const apiKey = body.apiKey?.trim() || undefined;
				if (!baseURL) return c.json({ error: 'Base URL is required' }, 400);

				if (compatibility !== 'ollama') {
					return c.json({
						models: [],
						unsupported: true,
						message:
							'Model discovery is currently available for Ollama providers.',
					});
				}

				const discovered = await discoverOllamaModels({
					baseURL,
					apiKey,
					includeDetails: true,
				});

				return c.json({
					baseURL: discovered.baseURL,
					models: discovered.models.map(toDiscoveredModel),
				});
			} catch (error) {
				logger.error('Failed to discover provider models', error);
				const errorResponse = serializeError(error);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'put',
			path: '/v1/config/providers/{provider}',
			tags: ['config'],
			operationId: 'updateProviderSettings',
			summary: 'Create or update provider settings',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: {
						$ref: '#/components/schemas/Provider',
					},
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								enabled: {
									type: 'boolean',
								},
								custom: {
									type: 'boolean',
								},
								label: {
									type: 'string',
								},
								compatibility: {
									type: 'string',
								},
								family: {
									type: 'string',
								},
								baseURL: {
									type: 'string',
									nullable: true,
								},
								apiKey: {
									type: 'string',
									nullable: true,
								},
								apiKeyEnv: {
									type: 'string',
									nullable: true,
								},
								models: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								allowAnyModel: {
									type: 'boolean',
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: {
										type: 'boolean',
									},
									provider: {
										$ref: '#/components/schemas/Provider',
									},
									details: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/ProviderDetail',
										},
									},
								},
								required: ['success', 'provider', 'details'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
					return c.json(
						{ error: 'Custom providers require compatibility' },
						400,
					);
				}

				await writeProviderSettings('global', provider, updates, projectRoot);
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/config/providers/{provider}',
			tags: ['config'],
			operationId: 'deleteProviderSettings',
			summary: 'Delete provider override or custom provider entry',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: {
						$ref: '#/components/schemas/Provider',
					},
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: {
										type: 'boolean',
									},
									provider: {
										$ref: '#/components/schemas/Provider',
									},
									details: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/ProviderDetail',
										},
									},
								},
								required: ['success', 'provider', 'details'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
				if (!provider) return c.json({ error: 'Provider is required' }, 400);

				await removeProviderSettings('global', provider, projectRoot);
				const cfg = await loadConfig(projectRoot);
				const details = await getProviderDetails(undefined, cfg);
				return c.json({ success: true, provider, details });
			} catch (error) {
				logger.error('Failed to remove provider settings', error);
				const errorResponse = serializeError(error);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);
}
