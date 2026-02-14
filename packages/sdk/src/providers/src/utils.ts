import { catalog } from './catalog-merged.ts';
import type { ProviderId, ModelInfo } from '../../types/src/index.ts';
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

	// For OAuth or when no preferred model found, use cost-based selection
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
	// 1) Check provider's own catalog entry
	const entry = catalog[provider];
	const modelInfo = entry?.models?.find((m) => m.id === model);
	if (modelInfo?.provider?.npm) return modelInfo.provider.npm;
	if (entry?.npm) return entry.npm;

	// 2) Search entire catalog for the model
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
	if (provider === 'anthropic') return true;
	const npm = getModelNpmBinding(provider, model);
	if (npm === '@ai-sdk/anthropic') return true;
	return false;
}

export type UnderlyingProviderKey =
	| 'anthropic'
	| 'openai'
	| 'google'
	| 'moonshot'
	| 'minimax'
	| 'glm'
	| 'openai-compatible'
	| null;

export function getUnderlyingProviderKey(
	provider: ProviderId,
	model: string,
): UnderlyingProviderKey {
	if (provider === 'anthropic') return 'anthropic';
	if (provider === 'openai') return 'openai';
	if (provider === 'google') return 'google';
	if (provider === 'moonshot') return 'moonshot';
	if (provider === 'minimax') return 'minimax';
	if (provider === 'copilot') return 'openai';

	if (provider === 'zai' || provider === 'zai-coding') return 'glm';

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
	// 1) Direct provider mapping
	if (provider === 'anthropic') return 'anthropic';
	if (provider === 'openai') return 'openai';
	if (provider === 'google') return 'google';
	if (provider === 'moonshot') return 'moonshot';
	if (provider === 'minimax') return 'minimax';
	if (provider === 'copilot') return 'openai';
	if (provider === 'zai' || provider === 'zai-coding') return 'glm';

	// 2) For aggregate providers, infer from model ID patterns
	if (provider === 'openrouter' || provider === 'opencode') {
		const lowerModel = model.toLowerCase();
		// Anthropic models
		if (lowerModel.includes('claude') || lowerModel.startsWith('anthropic/')) {
			return 'anthropic';
		}
		// OpenAI models
		if (
			lowerModel.includes('gpt') ||
			lowerModel.startsWith('openai/') ||
			lowerModel.includes('codex')
		) {
			return 'openai';
		}
		// Google models
		if (lowerModel.includes('gemini') || lowerModel.startsWith('google/')) {
			return 'google';
		}
		// Moonshot models
		if (lowerModel.includes('kimi') || lowerModel.startsWith('moonshotai/')) {
			return 'moonshot';
		}
		if (
			lowerModel.includes('glm') ||
			lowerModel.startsWith('z-ai/') ||
			lowerModel.startsWith('thudm/')
		) {
			return 'glm';
		}
		if (lowerModel.includes('minimax')) {
			return 'minimax';
		}
	}

	// 2) Check model's family field in catalog
	const info = getModelInfo(provider, model);
	if (info?.provider?.family) {
		return info.provider.family as UnderlyingProviderKey;
	}

	// 3) Fall back to npm binding (for zai and other providers)
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
