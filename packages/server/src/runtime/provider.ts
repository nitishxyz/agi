import type { LanguageModel } from 'ai';
import type { AGIConfig } from '@agi-cli/config';
import type { ProviderId } from '@agi-cli/types';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getAuth } from '@agi-cli/auth';
import { refreshToken } from '@agi-cli/auth/oauth';
import { setAuth } from '@agi-cli/auth';

export type ProviderName = ProviderId;

function getOpenRouterInstance() {
	const apiKey = process.env.OPENROUTER_API_KEY ?? '';
	return createOpenRouter({ apiKey });
}

async function getAnthropicInstance(cfg: AGIConfig) {
	const auth = await getAuth('anthropic', cfg.projectRoot);

	if (auth?.type === 'oauth') {
		let currentAuth = auth;

		if (currentAuth.expires < Date.now()) {
			const tokens = await refreshToken(currentAuth.refresh);
			await setAuth(
				'anthropic',
				{
					type: 'oauth',
					refresh: tokens.refresh,
					access: tokens.access,
					expires: tokens.expires,
				},
				cfg.projectRoot,
				'global',
			);
			currentAuth = {
				type: 'oauth',
				refresh: tokens.refresh,
				access: tokens.access,
				expires: tokens.expires,
			};
		}

		const customFetch = async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const initHeaders = init?.headers;
			const headers: Record<string, string> = {};

			if (initHeaders) {
				if (initHeaders instanceof Headers) {
					initHeaders.forEach((value, key) => {
						if (key.toLowerCase() !== 'x-api-key') {
							headers[key] = value;
						}
					});
				} else if (Array.isArray(initHeaders)) {
					for (const [key, value] of initHeaders) {
						if (
							key &&
							key.toLowerCase() !== 'x-api-key' &&
							typeof value === 'string'
						) {
							headers[key] = value;
						}
					}
				} else {
					for (const [key, value] of Object.entries(initHeaders)) {
						if (
							key.toLowerCase() !== 'x-api-key' &&
							typeof value === 'string'
						) {
							headers[key] = value;
						}
					}
				}
			}

			headers.authorization = `Bearer ${currentAuth.access}`;
			headers['anthropic-beta'] =
				'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14';

			return fetch(input, {
				...init,
				headers,
			});
		};
		return createAnthropic({
			apiKey: '',
			fetch: customFetch as typeof fetch,
		});
	}

	return anthropic;
}

function toLanguageModel(model: unknown): LanguageModel {
	return model as LanguageModel;
}

export async function resolveModel(
	provider: ProviderName,
	model: string,
	cfg: AGIConfig,
): Promise<LanguageModel> {
	if (provider === 'openai') return toLanguageModel(openai(model));
	if (provider === 'anthropic') {
		const instance = await getAnthropicInstance(cfg);
		return toLanguageModel(instance(model));
	}
	if (provider === 'google') return toLanguageModel(google(model));
	if (provider === 'openrouter') {
		const openrouter = getOpenRouterInstance();
		return toLanguageModel(openrouter.chat(model));
	}
	if (provider === 'opencode') {
		const baseURL = 'https://opencode.ai/zen/v1';
		const apiKey = process.env.OPENCODE_API_KEY ?? '';

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
