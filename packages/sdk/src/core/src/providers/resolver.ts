import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
	catalog,
	createSolforgeModel,
	createOpenAIOAuthModel,
} from '../../../providers/src/index.ts';
import type { OAuth } from '../../../types/src/index.ts';

function needsResponsesApi(model: string): boolean {
	const m = model.toLowerCase();
	if (m.includes('gpt-5')) return true;
	if (m.startsWith('o1')) return true;
	if (m.startsWith('o3')) return true;
	if (m.startsWith('o4')) return true;
	if (m.includes('codex-mini')) return true;
	return false;
}

function resolveOpenAIModel(
	instance: ReturnType<typeof createOpenAI>,
	model: string,
) {
	return needsResponsesApi(model) ? instance.responses(model) : instance(model);
}

export type ProviderName =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'openrouter'
	| 'opencode'
	| 'solforge'
	| 'zai'
	| 'zai-coding';

export type ModelConfig = {
	apiKey?: string;
	customFetch?: typeof fetch;
	baseURL?: string;
	oauth?: OAuth;
	projectRoot?: string;
};

export async function resolveModel(
	provider: ProviderName,
	model: string,
	config: ModelConfig = {},
) {
	if (provider === 'openai') {
		if (config.oauth) {
			return createOpenAIOAuthModel(model, {
				oauth: config.oauth,
				projectRoot: config.projectRoot,
			});
		}
		if (config.customFetch) {
			const instance = createOpenAI({
				apiKey: config.apiKey || 'oauth-token',
				fetch: config.customFetch,
			});
			return resolveOpenAIModel(instance, model);
		}
		if (config.apiKey) {
			const instance = createOpenAI({ apiKey: config.apiKey });
			return resolveOpenAIModel(instance, model);
		}
		return needsResponsesApi(model) ? openai.responses(model) : openai(model);
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
			const instance = createGoogleGenerativeAI({ apiKey: config.apiKey });
			return instance(model);
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

	if (provider === 'solforge') {
		const privateKey = config.apiKey || process.env.SOLFORGE_PRIVATE_KEY || '';
		if (!privateKey) {
			throw new Error(
				'Solforge provider requires SOLFORGE_PRIVATE_KEY (base58 Solana secret).',
			);
		}
		const baseURL = config.baseURL || process.env.SOLFORGE_BASE_URL;
		const rpcURL = process.env.SOLFORGE_SOLANA_RPC_URL;
		return createSolforgeModel(
			model,
			{ privateKey },
			{
				baseURL,
				rpcURL,
			},
		);
	}

	if (provider === 'zai') {
		const entry = catalog[provider];
		const apiKey =
			config.apiKey ||
			process.env.ZAI_API_KEY ||
			process.env.ZHIPU_API_KEY ||
			'';
		const baseURL =
			config.baseURL || entry?.api || 'https://api.z.ai/api/paas/v4';
		const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
		const instance = createOpenAICompatible({
			name: entry?.label ?? 'Z.AI',
			baseURL,
			headers,
		});
		return instance(model);
	}

	if (provider === 'zai-coding') {
		const entry = catalog[provider];
		const apiKey =
			config.apiKey ||
			process.env.ZAI_API_KEY ||
			process.env.ZHIPU_API_KEY ||
			'';
		const baseURL =
			config.baseURL || entry?.api || 'https://api.z.ai/api/coding/paas/v4';
		const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
		const instance = createOpenAICompatible({
			name: entry?.label ?? 'Z.AI Coding',
			baseURL,
			headers,
		});
		return instance(model);
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
