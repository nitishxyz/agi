import { catalog } from './catalog-merged.ts';
import type {
	ProviderId,
	ModelInfo,
	ModelOwner,
} from '../../types/src/index.ts';
import { filterModelsForAuthType } from './oauth-models.ts';

export const providerIds = Object.keys(catalog) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
	return typeof value === 'string' && providerIds.includes(value as ProviderId);
}

export function defaultModelFor(provider: ProviderId): string | undefined {
	return catalog[provider]?.models?.[0]?.id;
}

export function listModels(provider: ProviderId): string[] {
	return (catalog[provider]?.models ?? []).map((m) => m.id);
}

export function hasModel(
	provider: ProviderId,
	model: string | undefined,
): boolean {
	if (!model) return false;
	return listModels(provider).includes(model);
}

const PREFERRED_FAST_MODELS: Partial<Record<ProviderId, string[]>> = {
	openai: ['gpt-4.1-mini'],
	anthropic: ['claude-3-5-haiku-latest'],
	google: ['gemini-2.0-flash-lite'],
	openrouter: ['anthropic/claude-3.5-haiku'],
	opencode: ['claude-3-5-haiku'],
	setu: ['kimi-k2-turbo-preview'],
	zai: ['glm-4.5-flash'],
	copilot: ['gpt-4.1-mini'],
};

export function getFastModel(provider: ProviderId): string | undefined {
	const providerModels = catalog[provider]?.models ?? [];
	if (!providerModels.length) return undefined;

	const preferred = PREFERRED_FAST_MODELS[provider] ?? [];
	for (const modelId of preferred) {
		if (providerModels.some((m) => m.id === modelId)) {
			return modelId;
		}
	}

	const sorted = [...providerModels]
		.filter((m) => m.cost?.input !== undefined && m.toolCall !== false)
		.sort((a, b) => (a.cost?.input ?? Infinity) - (b.cost?.input ?? Infinity));

	return sorted[0]?.id ?? providerModels[0]?.id;
}

export function getFastModelForAuth(
	provider: ProviderId,
	authType: 'api' | 'oauth' | 'wallet' | undefined,
): string | undefined {
	const providerModels = catalog[provider]?.models ?? [];
	if (!providerModels.length) return undefined;

	const filteredModels = filterModelsForAuthType(
		provider,
		providerModels,
		authType,
	);
	if (!filteredModels.length) return getFastModel(provider);

	if (authType !== 'oauth') {
		const preferred = PREFERRED_FAST_MODELS[provider] ?? [];
		for (const modelId of preferred) {
			if (filteredModels.some((m) => m.id === modelId)) {
				return modelId;
			}
		}
	}

	const sorted = [...filteredModels]
		.filter(
			(m: ModelInfo) => m.cost?.input !== undefined && m.toolCall !== false,
		)
		.sort(
			(a: ModelInfo, b: ModelInfo) =>
				(a.cost?.input ?? Infinity) - (b.cost?.input ?? Infinity),
		);

	return sorted[0]?.id ?? filteredModels[0]?.id;
}

export function getModelNpmBinding(
	provider: ProviderId,
	model: string,
): string | undefined {
	const entry = catalog[provider];
	const modelInfo = entry?.models?.find((m) => m.id === model);
	if (modelInfo?.provider?.npm) return modelInfo.provider.npm;
	if (entry?.npm) return entry.npm;

	for (const key of Object.keys(catalog) as ProviderId[]) {
		const e = catalog[key];
		const m = e?.models?.find((x) => x.id === model);
		if (m?.provider?.npm) return m.provider.npm;
		if (m && e?.npm) return e.npm;
	}
	return undefined;
}

export function isAnthropicBasedModel(
	provider: ProviderId,
	model: string,
): boolean {
	const info = getModelInfo(provider, model);
	if (info?.ownedBy === 'anthropic') return true;
	if (provider === 'anthropic') return true;
	return false;
}

const OWNER_TO_FAMILY: Record<ModelOwner, UnderlyingProviderKey> = {
	openai: 'openai',
	anthropic: 'anthropic',
	google: 'google',
	xai: 'openai',
	moonshot: 'moonshot',
	zai: 'glm',
	minimax: 'minimax',
};

const DIRECT_PROVIDER_FAMILY: Partial<
	Record<ProviderId, UnderlyingProviderKey>
> = {
	openai: 'openai',
	anthropic: 'anthropic',
	google: 'google',
	moonshot: 'moonshot',
	minimax: 'minimax',
	copilot: 'openai',
	zai: 'glm',
	'zai-coding': 'glm',
};

export type UnderlyingProviderKey =
	| 'anthropic'
	| 'openai'
	| 'google'
	| 'moonshot'
	| 'minimax'
	| 'glm'
	| 'openai-compatible'
	| null;

function inferFromModelId(model: string): UnderlyingProviderKey {
	const lower = model.toLowerCase();
	if (lower.includes('claude') || lower.startsWith('anthropic/'))
		return 'anthropic';
	if (
		lower.includes('gpt') ||
		lower.startsWith('openai/') ||
		lower.includes('codex')
	)
		return 'openai';
	if (lower.includes('gemini') || lower.startsWith('google/')) return 'google';
	if (lower.includes('kimi') || lower.startsWith('moonshotai/'))
		return 'moonshot';
	if (
		lower.includes('glm') ||
		lower.startsWith('z-ai/') ||
		lower.startsWith('thudm/')
	)
		return 'glm';
	if (lower.includes('minimax')) return 'minimax';
	return null;
}

export function getUnderlyingProviderKey(
	provider: ProviderId,
	model: string,
): UnderlyingProviderKey {
	const info = getModelInfo(provider, model);
	if (info?.ownedBy) {
		return OWNER_TO_FAMILY[info.ownedBy];
	}

	const direct = DIRECT_PROVIDER_FAMILY[provider];
	if (direct) return direct;

	const fromId = inferFromModelId(model);
	if (fromId) return fromId;

	const npm = getModelNpmBinding(provider, model);
	if (npm === '@ai-sdk/anthropic') return 'anthropic';
	if (npm === '@ai-sdk/openai') return 'openai';
	if (npm === '@ai-sdk/google') return 'google';
	if (npm === '@ai-sdk/openai-compatible') return 'openai-compatible';
	if (npm === '@openrouter/ai-sdk-provider') return 'openai-compatible';
	return null;
}

export function getModelFamily(
	provider: ProviderId,
	model: string,
): UnderlyingProviderKey {
	const info = getModelInfo(provider, model);
	if (info?.ownedBy) {
		return OWNER_TO_FAMILY[info.ownedBy];
	}

	const direct = DIRECT_PROVIDER_FAMILY[provider];
	if (direct) return direct;

	return getUnderlyingProviderKey(provider, model);
}

export function getModelInfo(
	provider: ProviderId,
	model: string,
): ModelInfo | undefined {
	const entry = catalog[provider];
	if (!entry) return undefined;
	return entry.models?.find((m) => m.id === model);
}

export function modelSupportsReasoning(
	provider: ProviderId,
	model: string,
): boolean {
	const info = getModelInfo(provider, model);
	return info?.reasoningText === true;
}
