import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3Middleware } from '@ai-sdk/provider';
import type { ProviderApiFormat, ProviderId, FetchFunction } from '../types.ts';
import { createSetuOpenRouterFetch } from '../fetch.ts';

export function createModel(
	modelId: string,
	apiFormat: ProviderApiFormat,
	providerId: ProviderId,
	baseURL: string,
	customFetch: FetchFunction,
	middleware?: LanguageModelV3Middleware | LanguageModelV3Middleware[],
) {
	const applyMiddleware = <TModel>(model: TModel) => {
		if (middleware) {
			return wrapLanguageModel({ model: model as never, middleware });
		}

		return model;
	};

	switch (apiFormat) {
		case 'anthropic-messages': {
			const provider = createAnthropic({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: customFetch as unknown as typeof globalThis.fetch,
			});
			return applyMiddleware(provider(modelId));
		}

		case 'google-native': {
			const provider = createGoogleGenerativeAI({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: customFetch as unknown as typeof globalThis.fetch,
			});
			return applyMiddleware(provider(modelId));
		}

		case 'openrouter-chat': {
			const provider = createOpenRouter({
				baseURL,
				apiKey: 'setu-wallet-auth',
				compatibility: 'strict',
				fetch: createSetuOpenRouterFetch(
					customFetch,
				) as unknown as typeof globalThis.fetch,
			});
			return applyMiddleware(provider.chat(`openrouter/${modelId}`));
		}

		case 'openai-chat': {
			const provider = createOpenAICompatible({
				name: `setu-${providerId}`,
				baseURL,
				headers: { Authorization: 'Bearer setu-wallet-auth' },
				fetch: customFetch as unknown as typeof globalThis.fetch,
			});
			return applyMiddleware(provider(modelId));
		}
		default: {
			const provider = createOpenAI({
				baseURL,
				apiKey: 'setu-wallet-auth',
				fetch: customFetch as unknown as typeof globalThis.fetch,
			});
			return applyMiddleware(provider.responses(modelId));
		}
	}
}
