import type { ProviderId } from '@/auth/index.ts';
import { getAllAuth } from '@/auth/index.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { catalog } from '@/providers/catalog.ts';
import type { AskOptions } from './types.ts';

type LoadedConfig = Awaited<ReturnType<typeof loadConfig>>;

type ProviderState = {
	chosenProvider: ProviderId;
	chosenModel: string;
	providerOverride?: ProviderId;
	modelOverride?: string;
};

type EnvMap = Record<ProviderId, boolean>;

function collectEnvAuth(): EnvMap {
	return {
		openai: Boolean(process.env.OPENAI_API_KEY),
		anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
		google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
		opencode: Boolean(process.env.OPENCODE_API_KEY),
		openrouter: Boolean(process.env.OPENROUTER_API_KEY),
	};
}

function collectConfigAuth(cfg: LoadedConfig): EnvMap {
	return {
		openai: Boolean(cfg.providers.openai?.apiKey),
		anthropic: Boolean(cfg.providers.anthropic?.apiKey),
		google: Boolean(cfg.providers.google?.apiKey),
		opencode: Boolean(cfg.providers.opencode?.apiKey),
		openrouter: Boolean(cfg.providers.openrouter?.apiKey),
	};
}

export type AskEnvironment = {
	projectRoot: string;
	config: LoadedConfig;
	agent: string;
	agentProviderDefault: ProviderId;
	agentModelDefault: string;
} & ProviderState;

export async function prepareAskEnvironment(opts: AskOptions): Promise<AskEnvironment> {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);
	const agent = opts.agent ?? cfg.defaults.agent;
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, agent);
	const agentProviderDefault =
		(agentCfg.provider as ProviderId | undefined) ?? cfg.defaults.provider;
	const agentModelDefault = agentCfg.model ?? cfg.defaults.model;

	const baseState: ProviderState = {
		chosenProvider: opts.provider ?? agentProviderDefault,
		chosenModel: opts.model ?? agentModelDefault,
	};

	const providerState = await ensureAuthorizedProvider(
		baseState,
		projectRoot,
		cfg,
		agentProviderDefault,
		agentModelDefault,
		opts.provider,
		opts.model,
	);

	return {
		projectRoot,
		config: cfg,
		agent,
		agentProviderDefault,
		agentModelDefault,
		...providerState,
	};
}

async function ensureAuthorizedProvider(
	state: ProviderState,
	projectRoot: string,
	cfg: LoadedConfig,
	agentProviderDefault: ProviderId,
	agentModelDefault: string,
	explicitProvider: ProviderId | undefined,
	explicitModel: string | undefined,
): Promise<ProviderState> {
	let { chosenProvider, chosenModel } = state;
	let providerOverride: ProviderId | undefined;
	let modelOverride: string | undefined;
	try {
		const auth = await getAllAuth(projectRoot);
		const envHas = collectEnvAuth();
		const cfgHas = collectConfigAuth(cfg);
		const authed = (p: ProviderId) => {
			const info = auth[p];
			const hasStoredApi = info?.type === 'api' && Boolean(info.key);
			return envHas[p] || hasStoredApi || cfgHas[p];
		};
		if (!authed(chosenProvider)) {
			const order: ProviderId[] = [
				'anthropic',
				'openai',
				'google',
				'opencode',
			];
			const alt = order.find((p) => authed(p));
			if (alt) chosenProvider = alt;
		}
		const models = catalog[chosenProvider]?.models ?? [];
		const ok = models.some((m) => m.id === chosenModel);
		if (!ok && models.length) chosenModel = models[0].id;
	} catch {}

	providerOverride =
		explicitProvider ??
		(chosenProvider !== agentProviderDefault ? chosenProvider : undefined);
	modelOverride =
		explicitModel ??
		(chosenModel !== agentModelDefault ? chosenModel : undefined);

	return { chosenProvider, chosenModel, providerOverride, modelOverride };
}
