import type { OttoConfig } from '@ottocode/sdk';
import {
	catalog,
	type ProviderId,
	isProviderAuthorized,
	providerIds,
	defaultModelFor,
	hasModel,
} from '@ottocode/sdk';

const FALLBACK_ORDER: ProviderId[] = [
	'anthropic',
	'openai',
	'google',
	'opencode',
	'openrouter',
	'setu',
];

type SelectionInput = {
	cfg: OttoConfig;
	agentProviderDefault: ProviderId;
	agentModelDefault: string;
	explicitProvider?: ProviderId;
	explicitModel?: string;
	skipAuth?: boolean;
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
		skipAuth,
	} = input;

	const provider = skipAuth
		? (explicitProvider ?? agentProviderDefault)
		: await pickAuthorizedProvider({
				cfg,
				candidate: explicitProvider ?? agentProviderDefault,
			});

	if (!provider) {
		throw new Error(
			'No authorized providers found. Run `otto auth login` to configure at least one provider.',
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
	cfg: OttoConfig;
	candidate: ProviderId;
}): Promise<ProviderId | undefined> {
	const { cfg, candidate } = args;
	const candidates = uniqueProviders([
		candidate,
		...FALLBACK_ORDER,
		...providerIds,
	]);
	for (const provider of candidates) {
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
