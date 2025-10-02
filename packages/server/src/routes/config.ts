import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/config';
import {
	catalog,
	type ProviderId,
	isProviderAuthorized,
} from '@agi-cli/providers';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export function registerConfigRoutes(app: Hono) {
	// Get full config (agents, providers, models, defaults)
	app.get('/v1/config', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);

		const builtInAgents = ['general', 'build', 'plan'];
		let customAgents: string[] = [];

		try {
			const customAgentsPath = join(cfg.projectRoot, '.agi', 'agents');
			const files = await readdir(customAgentsPath).catch(() => []);
			customAgents = files
				.filter((f) => f.endsWith('.txt'))
				.map((f) => f.replace('.txt', ''));
		} catch {}

		const allProviders = Object.keys(catalog) as ProviderId[];
		const authorizedProviders: ProviderId[] = [];

		for (const provider of allProviders) {
			const authorized = await isProviderAuthorized(cfg, provider);
			if (authorized) {
				authorizedProviders.push(provider);
			}
		}

		return c.json({
			agents: [...builtInAgents, ...customAgents],
			providers: authorizedProviders,
			defaults: cfg.defaults,
		});
	});

	// Get available agents
	app.get('/v1/config/agents', async (c) => {
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
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);

		const allProviders = Object.keys(catalog) as ProviderId[];
		const authorizedProviders: ProviderId[] = [];

		for (const provider of allProviders) {
			const authorized = await isProviderAuthorized(cfg, provider);
			if (authorized) {
				authorizedProviders.push(provider);
			}
		}

		return c.json({
			providers: authorizedProviders,
			default: cfg.defaults.provider,
		});
	});

	// Get available models for a provider
	app.get('/v1/config/providers/:provider/models', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const provider = c.req.param('provider') as ProviderId;

		const authorized = await isProviderAuthorized(cfg, provider);
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
			default: cfg.defaults.model,
		});
	});
}
