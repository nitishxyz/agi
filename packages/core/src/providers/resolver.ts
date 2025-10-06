import type { LanguageModel } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type ProviderName =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'openrouter'
	| 'opencode';

export type ModelConfig = {
	apiKey?: string;
	customFetch?: typeof fetch;
	baseURL?: string;
};

function toLanguageModel(model: unknown): LanguageModel {
	return model as LanguageModel;
}

export async function resolveModel(
	provider: ProviderName,
	model: string,
	config: ModelConfig = {},
): Promise<LanguageModel> {
	if (provider === 'openai') {
		if (config.apiKey) {
			const instance = createOpenAI({ apiKey: config.apiKey });
			return toLanguageModel(instance(model));
		}
		return toLanguageModel(openai(model));
	}

	if (provider === 'anthropic') {
		if (config.customFetch) {
			const instance = createAnthropic({
				apiKey: config.apiKey || '',
				fetch: config.customFetch as typeof fetch,
			});
			return toLanguageModel(instance(model));
		}
		if (config.apiKey) {
			const instance = createAnthropic({ apiKey: config.apiKey });
			return toLanguageModel(instance(model));
		}
		return toLanguageModel(anthropic(model));
	}

	if (provider === 'google') {
		if (config.apiKey) {
			throw new Error('Google provider config not yet supported in SDK');
		}
		return toLanguageModel(google(model));
	}

	if (provider === 'openrouter') {
		const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
		const openrouter = createOpenRouter({ apiKey });
		return toLanguageModel(openrouter.chat(model));
	}

	if (provider === 'opencode') {
		const baseURL = config.baseURL || 'https://opencode.ai/zen/v1';
		const apiKey = config.apiKey || process.env.OPENCODE_API_KEY || '';

		const ocOpenAI = createOpenAI({ apiKey, baseURL });
		const ocAnthropic = createAnthropic({ apiKey, baseURL });
		const ocCompat = createOpenAICompatible({
			name: 'opencode',
			baseURL,
			headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
		});

		const id = model.toLowerCase();
		if (id.includes('claude')) return toLanguageModel(ocAnthropic(model));
		if (
			id.includes('qwen3-coder') ||
			id.includes('grok-code') ||
			id.includes('kimi-k2')
		)
			return toLanguageModel(ocCompat(model));
		return toLanguageModel(ocOpenAI(model));
	}

	throw new Error(`Unsupported provider: ${provider}`);
}
