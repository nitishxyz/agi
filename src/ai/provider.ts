import type { AGIConfig } from '@/config/index.ts';
import type { ProviderId } from '@/providers/catalog.ts';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type ProviderName = ProviderId;

function getOpenRouterInstance() {
	const apiKey = process.env.OPENROUTER_API_KEY ?? '';
	return createOpenRouter({ apiKey });
}

export async function resolveModel(
	provider: ProviderName,
	model: string,
	_cfg: AGIConfig,
) {
	if (provider === 'openai') return openai(model);
	if (provider === 'anthropic') return anthropic(model);
	if (provider === 'google') return google(model);
	if (provider === 'openrouter') {
		// Prefer chat models for AI SDK v5 generate/streamText
		const openrouter = getOpenRouterInstance();
		return openrouter.chat(model);
	}
	if (provider === 'opencode') {
		// opencode is a multi-backend router with different endpoint flavors
		// Map models to the appropriate SDK with a shared base URL
		const baseURL = 'https://opencode.ai/zen/v1';
		const apiKey = process.env.OPENCODE_API_KEY ?? '';

		// Lazily create instances so we reuse connections
		const ocOpenAI = createOpenAI({ apiKey, baseURL }); // uses /responses
		const ocAnthropic = createAnthropic({ apiKey, baseURL }); // uses /messages
		const ocCompat = createOpenAICompatible({
			name: 'opencode',
			baseURL, // uses /chat/completions
			headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
		});

		const id = model.toLowerCase();
		// Anthropic family
		if (id.includes('claude')) return ocAnthropic(model);
		// OpenAI-compatible chat completions family
		if (
			id.includes('qwen3-coder') ||
			id.includes('grok-code') ||
			id.includes('kimi-k2')
		)
			return ocCompat.chat(model);
		// Default to OpenAI Responses flavor (e.g., gpt-5)
		return ocOpenAI(model);
	}
	throw new Error(`Unsupported provider: ${provider}`);
}
