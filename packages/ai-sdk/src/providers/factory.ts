import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3Middleware } from '@ai-sdk/provider';
import type { ProviderApiFormat, ProviderId, FetchFunction } from '../types.ts';

export function createModel(
	modelId: string,
	apiFormat: ProviderApiFormat,
	providerId: ProviderId,
	baseURL: string,
	customFetch: FetchFunction,
	middleware?: LanguageModelV3Middleware | LanguageModelV3Middleware[],
) {
	const fetchFn = customFetch as unknown as typeof globalThis.fetch;

	let model;

	switch (apiFormat) {
		case 'anthropic-messages': {
			const provider = createAnthropic({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: fetchFn,
			});
			model = provider(modelId);
			break;
		}

		case 'google-native': {
			const provider = createGoogleGenerativeAI({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: fetchFn,
			});
			model = provider(modelId);
			break;
		}

		case 'openai-chat': {
			const provider = createOpenAICompatible({
				name: `setu-${providerId}`,
				baseURL,
				headers: { Authorization: 'Bearer setu-wallet-auth' },
				fetch: fetchFn,
			});
			model = provider(modelId);
			break;
		}

		case 'openai-responses':
		default: {
			const provider = createOpenAI({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: fetchFn,
			});
			model = provider.responses(modelId);
			break;
		}
	}

	if (middleware) {
		return wrapLanguageModel({ model, middleware });
	}

	return model;
}
