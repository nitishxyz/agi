import type { AGIConfig } from '@/config/index.ts';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter';

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
	throw new Error(`Unsupported provider: ${provider}`);
}
