import { createAnthropic } from '@ai-sdk/anthropic';
import { catalog } from './catalog-merged.ts';

export type MinimaxProviderConfig = {
	apiKey?: string;
	baseURL?: string;
};

export function createMinimaxModel(
	model: string,
	config?: MinimaxProviderConfig,
) {
	const entry = catalog.minimax;
	const baseURL =
		config?.baseURL || entry?.api || 'https://api.minimax.io/anthropic/v1';
	const apiKey = config?.apiKey || process.env.MINIMAX_API_KEY || '';

	const instance = createAnthropic({
		apiKey,
		baseURL,
	});

	return instance(model);
}
