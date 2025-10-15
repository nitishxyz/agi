import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { catalog } from '../../../providers/src/index.ts';

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

export async function resolveModel(
	provider: ProviderName,
	model: string,
	config: ModelConfig = {},
) {
	if (provider === 'openai') {
		if (config.apiKey) {
			const instance = createOpenAI({ apiKey: config.apiKey });
			return instance(model);
		}
		return openai(model);
	}

	if (provider === 'anthropic') {
		if (config.customFetch) {
			return createAnthropic({
				apiKey: config.apiKey || '',
				fetch: config.customFetch as typeof fetch,
			});
		}
		if (config.apiKey) {
			const instance = createAnthropic({ apiKey: config.apiKey });
			return instance(model);
		}
		return anthropic(model);
	}

	if (provider === 'google') {
		if (config.apiKey) {
			throw new Error('Google provider config not yet supported in SDK');
		}
		return google(model);
	}

	if (provider === 'openrouter') {
		const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
		const openrouter = createOpenRouter({ apiKey });
		return openrouter.chat(model);
	}

	if (provider === 'opencode') {
		const entry = catalog[provider];
		const normalizedModel = normalizeModelIdentifier(provider, model);
		const modelInfo =
			entry?.models.find((m) => m.id === normalizedModel) ??
			entry?.models.find((m) => m.id === model);
		const resolvedModelId = modelInfo?.id ?? normalizedModel ?? model;
		const binding = modelInfo?.provider?.npm ?? entry?.npm;
		const apiKey = config.apiKey || process.env.OPENCODE_API_KEY || '';
		const baseURL =
			config.baseURL ||
			modelInfo?.provider?.baseURL ||
			modelInfo?.provider?.api ||
			entry?.api ||
			'https://opencode.ai/zen/v1';
		const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
		if (binding === '@ai-sdk/openai') {
			const instance = createOpenAI({ apiKey, baseURL });
			return instance(resolvedModelId);
		}
		if (binding === '@ai-sdk/anthropic') {
			const instance = createAnthropic({ apiKey, baseURL });
			return instance(resolvedModelId);
		}
		if (binding === '@ai-sdk/openai-compatible') {
			const instance = createOpenAICompatible({
				name: entry?.label ?? 'opencode',
				baseURL,
				headers,
			});
			return instance(resolvedModelId);
		}

		const ocOpenAI = createOpenAI({ apiKey, baseURL });
		const ocAnthropic = createAnthropic({ apiKey, baseURL });
		const ocCompat = createOpenAICompatible({
			name: entry?.label ?? 'opencode',
			baseURL,
			headers,
		});

		const id = resolvedModelId.toLowerCase();
		if (id.includes('claude')) return ocAnthropic(resolvedModelId);
		if (
			id.includes('qwen3-coder') ||
			id.includes('grok-code') ||
			id.includes('kimi-k2')
		)
			return ocCompat(resolvedModelId);
		return ocOpenAI(resolvedModelId);
	}

	throw new Error(`Unsupported provider: ${provider}`);
}

function normalizeModelIdentifier(
	provider: ProviderName,
	model: string,
): string {
	const prefix = `${provider}/`;
	return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}
