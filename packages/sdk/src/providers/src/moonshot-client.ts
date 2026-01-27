import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { catalog } from './catalog-merged.ts';

export type MoonshotProviderConfig = {
	apiKey?: string;
	baseURL?: string;
};

export function createMoonshotModel(
	model: string,
	config?: MoonshotProviderConfig,
) {
	const entry = catalog.moonshot;
	const baseURL = config?.baseURL || entry?.api || 'https://api.moonshot.ai/v1';
	const apiKey = config?.apiKey || process.env.MOONSHOT_API_KEY || '';
	const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

	const instance = createOpenAICompatible({
		name: entry?.label ?? 'Moonshot AI',
		baseURL,
		headers,
	});

	return instance(model);
}
