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
	openai: ['gpt-4o-mini', 'gpt-4.1-nano', 'gpt-4.1-mini'],
	anthropic: [
		'claude-3-5-haiku-latest',
		'claude-3-5-haiku-20241022',
		'claude-haiku-4-5',
	],
	google: [
		'gemini-2.0-flash-lite',
		'gemini-2.0-flash',
		'gemini-2.5-flash-lite',
	],
	openrouter: [
		'anthropic/claude-3.5-haiku',
		'openai/gpt-4o-mini',
		'google/gemini-2.0-flash-001',
	],
	opencode: ['claude-3-5-haiku', 'gpt-5-nano', 'gemini-3-flash'],
	setu: [
		'claude-3-5-haiku-latest',
		'claude-3-5-haiku-20241022',
		'codex-mini-latest',
	],
	zai: ['glm-4.5-flash', 'glm-4.5-air'],
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
	| 'openai-compatible'
	| null;

export function getUnderlyingProviderKey(
	provider: ProviderId,
	model: string,
): UnderlyingProviderKey {
	if (provider === 'anthropic') return 'anthropic';
	if (provider === 'openai') return 'openai';
	if (provider === 'google') return 'google';

	const npm = getModelNpmBinding(provider, model);
	if (npm === '@ai-sdk/anthropic') return 'anthropic';
	if (npm === '@ai-sdk/openai') return 'openai';
	if (npm === '@ai-sdk/google') return 'google';
	if (npm === '@ai-sdk/openai-compatible') return 'openai-compatible';
	if (npm === '@openrouter/ai-sdk-provider') return 'openai-compatible';
	return null;
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
