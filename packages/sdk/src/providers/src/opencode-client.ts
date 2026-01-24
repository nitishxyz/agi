import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { catalog } from './catalog-merged.ts';
import { createAnthropicCachingFetch } from './anthropic-caching.ts';
import type { ProviderId } from '../../types/src/index.ts';

export type OpencodeProviderConfig = {
	apiKey?: string;
};

function normalizeModelIdentifier(provider: ProviderId, model: string): string {
	const prefix = `${provider}/`;
	return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

export function createOpencodeModel(
	model: string,
	config?: OpencodeProviderConfig,
) {
	const entry = catalog.opencode;
	const normalizedModel = normalizeModelIdentifier('opencode', model);
	const modelInfo =
		entry?.models.find((m) => m.id === normalizedModel) ??
		entry?.models.find((m) => m.id === model);
	const resolvedModelId = modelInfo?.id ?? normalizedModel ?? model;
	const binding = modelInfo?.provider?.npm ?? entry?.npm;
	const apiKey = config?.apiKey ?? process.env.OPENCODE_API_KEY ?? '';
	const baseURL =
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
		const cachingFetch = createAnthropicCachingFetch();
		const instance = createAnthropic({
			apiKey,
			baseURL,
			fetch: cachingFetch as typeof fetch,
		});
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
	const cachingFetch = createAnthropicCachingFetch();
	const ocAnthropic = createAnthropic({
		apiKey,
		baseURL,
		fetch: cachingFetch as typeof fetch,
	});
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
