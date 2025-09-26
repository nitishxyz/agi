import type { AGIConfig } from '@/config/index.ts';
import { catalog, type ProviderId } from '@/providers/catalog.ts';
import { providerIds, defaultModelFor, hasModel } from '@/providers/utils.ts';
import { isProviderAuthorized } from '@/providers/authorization.ts';

const FALLBACK_ORDER: ProviderId[] = [
	'anthropic',
	'openai',
	'google',
	'opencode',
	'openrouter',
];

type SelectionInput = {
	cfg: AGIConfig;
	agentProviderDefault: ProviderId;
	agentModelDefault: string;
	explicitProvider?: ProviderId;
	explicitModel?: string;
};

export type ProviderSelection = {
	provider: ProviderId;
	model: string;
	providerOverride?: ProviderId;
	modelOverride?: string;
};

export async function selectProviderAndModel(
	input: SelectionInput,
): Promise<ProviderSelection> {
	const {
		cfg,
		agentProviderDefault,
		agentModelDefault,
		explicitProvider,
		explicitModel,
	} = input;

	const provider = await pickAuthorizedProvider({
		cfg,
		candidate: explicitProvider ?? agentProviderDefault,
		explicitProvider,
	});

	if (!provider) {
		throw new Error(
			'No authorized providers found. Run `agi auth login` to configure at least one provider.',
		);
	}

	const model = resolveModelForProvider({
		provider,
		explicitModel,
		agentModelDefault,
	});

	const providerOverride =
		explicitProvider ??
		(provider !== agentProviderDefault ? provider : undefined);
	const modelOverride =
		explicitModel ?? (model !== agentModelDefault ? model : undefined);

	return { provider, model, providerOverride, modelOverride };
}

async function pickAuthorizedProvider(args: {
	cfg: AGIConfig;
	candidate: ProviderId;
	explicitProvider?: ProviderId;
}): Promise<ProviderId | undefined> {
	const { cfg, candidate, explicitProvider } = args;
	const candidates = uniqueProviders([
		candidate,
		...FALLBACK_ORDER,
		...providerIds,
	]);
	for (const provider of candidates) {
		const enabled = cfg.providers[provider]?.enabled ?? true;
		const explicitlyRequested =
			explicitProvider != null && provider === explicitProvider;
		if (!enabled && !explicitlyRequested) continue;
		const ok = await isProviderAuthorized(cfg, provider);
		if (ok) return provider;
	}
	return undefined;
}

function uniqueProviders(list: ProviderId[]): ProviderId[] {
	const seen = new Set<ProviderId>();
	const ordered: ProviderId[] = [];
	for (const provider of list) {
		if (!providerIds.includes(provider)) continue;
		if (seen.has(provider)) continue;
		seen.add(provider);
		ordered.push(provider);
	}
	return ordered;
}

function resolveModelForProvider(args: {
	provider: ProviderId;
	explicitModel?: string;
	agentModelDefault: string;
}): string {
	const { provider, explicitModel, agentModelDefault } = args;
	if (explicitModel && hasModel(provider, explicitModel)) return explicitModel;
	if (hasModel(provider, agentModelDefault)) return agentModelDefault;
	return (
		defaultModelFor(provider) ??
		catalog[provider]?.models?.[0]?.id ??
		agentModelDefault
	);
}
