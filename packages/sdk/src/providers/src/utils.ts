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
		'openai/gpt-4o-mini',
		'google/gemini-2.0-flash-001',
		'anthropic/claude-3.5-haiku',
	],
	opencode: ['gpt-5-nano', 'claude-3-5-haiku', 'gemini-3-flash'],
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
	const entry = catalog[provider];
	if (!entry) return undefined;
	const modelInfo = entry.models?.find((m) => m.id === model);
	return modelInfo?.provider?.npm ?? entry.npm;
}

export function isAnthropicBasedModel(
	provider: ProviderId,
	model: string,
): boolean {
	if (provider === 'anthropic') return true;
	const npm = getModelNpmBinding(provider, model);
	if (npm === '@ai-sdk/anthropic') return true;
	const lower = model.toLowerCase();
	return lower.includes('claude') || lower.includes('anthropic');
}
