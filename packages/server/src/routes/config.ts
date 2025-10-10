import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import { catalog, type ProviderId, isProviderAuthorized } from '@agi-cli/sdk';
import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { EmbeddedAppConfig } from '../index.ts';
import type { AGIConfig } from '@agi-cli/sdk';

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

export function registerConfigRoutes(app: Hono) {
	// Get working directory info
	app.get('/v1/config/cwd', (c) => {
		const cwd = process.cwd();
		const dirName = basename(cwd);
		return c.json({
			cwd,
			dirName,
		});
	});

	// Get full config (agents, providers, models, defaults)
	app.get('/v1/config', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const embeddedConfig = c.get('embeddedConfig') as
			| EmbeddedAppConfig
			| undefined;

		// Always load file config as base/fallback
		const cfg = await loadConfig(projectRoot);

		// Hybrid mode: Merge embedded config with file config
		const builtInAgents = ['general', 'build', 'plan'];
		let customAgents: string[] = [];

		try {
			const customAgentsPath = join(cfg.projectRoot, '.agi', 'agents');
			const files = await readdir(customAgentsPath).catch(() => []);
			customAgents = files
				.filter((f) => f.endsWith('.txt'))
				.map((f) => f.replace('.txt', ''));
		} catch {}

		// Agents: Embedded custom agents + file-based agents
		const fileAgents = [...builtInAgents, ...customAgents];
		const embeddedAgents = embeddedConfig?.agents
			? Object.keys(embeddedConfig.agents)
			: [];
		const allAgents = Array.from(new Set([...embeddedAgents, ...fileAgents]));

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
	});

	// Get available agents
	app.get('/v1/config/agents', async (c) => {
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

		const builtInAgents = ['general', 'build', 'plan'];

		try {
			const customAgentsPath = join(cfg.projectRoot, '.agi', 'agents');
			const files = await readdir(customAgentsPath).catch(() => []);
			const customAgents = files
				.filter((f) => f.endsWith('.txt'))
				.map((f) => f.replace('.txt', ''));

			return c.json({
				agents: [...builtInAgents, ...customAgents],
				default: cfg.defaults.agent,
			});
		} catch {
			return c.json({
				agents: builtInAgents,
				default: cfg.defaults.agent,
			});
		}
	});

	// Get available providers (only authorized ones)
	app.get('/v1/config/providers', async (c) => {
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
	});

	// Get available models for a provider
	app.get('/v1/config/providers/:provider/models', async (c) => {
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
			return c.json({ error: 'Provider not authorized' }, 403);
		}

		const providerCatalog = catalog[provider];
		if (!providerCatalog) {
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
	});
}
