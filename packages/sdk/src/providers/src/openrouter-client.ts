import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createConditionalCachingFetch } from './anthropic-caching.ts';

export type OpenRouterProviderConfig = {
	apiKey?: string;
};

function isAnthropicModel(model: string): boolean {
	const lower = model.toLowerCase();
	return lower.includes('anthropic') || lower.includes('claude');
}

export function getOpenRouterInstance(model?: string, config?: OpenRouterProviderConfig) {
	const apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
	const customFetch = model
		? createConditionalCachingFetch(isAnthropicModel, model)
		: undefined;
	return createOpenRouter({ apiKey, fetch: customFetch });
}

export function createOpenRouterModel(model: string, config?: OpenRouterProviderConfig) {
	const openrouter = getOpenRouterInstance(model, config);
	return openrouter.chat(model);
}
