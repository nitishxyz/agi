import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import {
	catalog,
	type ProviderId,
	isProviderAuthorized,
	getGlobalAgentsDir,
} from '@agi-cli/sdk';
import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { EmbeddedAppConfig } from '../index.ts';
import type { AGIConfig } from '@agi-cli/sdk';
import { logger } from '../runtime/logger.ts';
import { serializeError } from '../runtime/api-error.ts';
import { loadAgentsConfig } from '../runtime/agent-registry.ts';

/**
 * Check if a provider is authorized in either embedded config or file-based config
 */
async function isProviderAuthorizedHybrid(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: AGIConfig,
	provider: ProviderId,
): Promise<boolean> {
	// Check embedded auth first
	const hasEmbeddedAuth =
		embeddedConfig?.provider === provider ||
		(embeddedConfig?.auth && provider in embeddedConfig.auth);

	if (hasEmbeddedAuth) {
		return true;
	}

	// Fallback to file-based auth
	return await isProviderAuthorized(fileConfig, provider);
}

/**
 * Get all authorized providers from both embedded and file-based config
 */
async function getAuthorizedProviders(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: AGIConfig,
): Promise<ProviderId[]> {
	const allProviders = Object.keys(catalog) as ProviderId[];
	const authorizedProviders: ProviderId[] = [];

	for (const provider of allProviders) {
		const authorized = await isProviderAuthorizedHybrid(
			embeddedConfig,
			fileConfig,
			provider,
		);
		if (authorized) {
			authorizedProviders.push(provider);
		}
	}

	return authorizedProviders;
}

/**
 * Get default value with embedded config taking priority over file config
 */
function getDefault<T>(
	embeddedValue: T | undefined,
	embeddedDefaultValue: T | undefined,
	fileValue: T,
): T {
	return embeddedValue ?? embeddedDefaultValue ?? fileValue;
}

/**
 * Discover all agents from all sources:
 * - Built-in agents (general, build, plan)
 * - agents.json (global + local)
 * - Agent files in .agi/agents/ (global + local)
 */
async function discoverAllAgents(projectRoot: string): Promise<string[]> {
	const builtInAgents = ['general', 'build', 'plan'];
	const agentSet = new Set<string>(builtInAgents);

	// Load agents from agents.json (global + local merged)
	try {
		const agentsJson = await loadAgentsConfig(projectRoot);
		for (const agentName of Object.keys(agentsJson)) {
			if (agentName.trim()) {
				agentSet.add(agentName);
			}
		}
	} catch (err) {
		logger.debug('Failed to load agents.json', err);
	}

	// Discover custom agent files from local .agi/agents/
	try {
		const localAgentsPath = join(projectRoot, '.agi', 'agents');
		const localFiles = await readdir(localAgentsPath).catch(() => []);
		for (const file of localFiles) {
			if (file.endsWith('.txt') || file.endsWith('.md')) {
				const agentName = file.replace(/\.(txt|md)$/, '');
				if (agentName.trim()) {
					agentSet.add(agentName);
				}
			}
		}
	} catch (err) {
		logger.debug('Failed to read local agents directory', err);
	}

	// Discover custom agent files from global ~/.config/agi/agents/
	try {
		const globalAgentsPath = getGlobalAgentsDir();
		const globalFiles = await readdir(globalAgentsPath).catch(() => []);
		for (const file of globalFiles) {
			if (file.endsWith('.txt') || file.endsWith('.md')) {
				const agentName = file.replace(/\.(txt|md)$/, '');
				if (agentName.trim()) {
					agentSet.add(agentName);
				}
			}
		}
	} catch (err) {
		logger.debug('Failed to read global agents directory', err);
	}

	return Array.from(agentSet).sort();
}

export function registerConfigRoutes(app: Hono) {
	// Get working directory info
	app.get('/v1/config/cwd', (c) => {
		try {
			const cwd = process.cwd();
			const dirName = basename(cwd);
			return c.json({
				cwd,
				dirName,
			});
		} catch (error) {
			logger.error('Failed to get current working directory', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	// Get full config (agents, providers, models, defaults)
	app.get('/v1/config', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			// Always load file config as base/fallback
			const cfg = await loadConfig(projectRoot);

			// Hybrid mode: Merge embedded config with file config
			let allAgents: string[];

			if (embeddedConfig?.agents) {
				// Embedded mode: use embedded agents + file agents
				const embeddedAgents = Object.keys(embeddedConfig.agents);
				const fileAgents = await discoverAllAgents(cfg.projectRoot);
				allAgents = Array.from(
					new Set([...embeddedAgents, ...fileAgents]),
				).sort();
			} else {
				// File mode: discover all agents
				allAgents = await discoverAllAgents(cfg.projectRoot);
			}

			// Providers: Check both embedded and file-based auth
			const authorizedProviders = await getAuthorizedProviders(
				embeddedConfig,
				cfg,
			);

			// Defaults: Embedded overrides file config
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

	// Get available agents
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

	// Get available providers (only authorized ones)
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

	// Get available models for a provider
	app.get('/v1/config/providers/:provider/models', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;
			const provider = c.req.param('provider') as ProviderId;

			// Always load file config for fallback auth check
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			// Check if provider is authorized (hybrid: embedded OR file-based)
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

	// Get all models grouped by provider
	app.get('/v1/config/models', async (c) => {
		try {
			const embeddedConfig = c.get('embeddedConfig') as
				| EmbeddedAppConfig
				| undefined;

			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);

			// Get all authorized providers
			const authorizedProviders = await getAuthorizedProviders(
				embeddedConfig,
				cfg,
			);

			// Build models map
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
