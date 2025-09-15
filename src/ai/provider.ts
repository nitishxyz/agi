import type { AGIConfig } from '@/config/index.ts';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export type ProviderName = 'openai' | 'anthropic' | 'google';

export function resolveModel(
	provider: ProviderName,
	model: string,
	cfg: AGIConfig,
) {
	if (provider === 'openai') return openai(model);
	if (provider === 'anthropic') return anthropic(model);
	if (provider === 'google') return google(model);
	throw new Error(`Unsupported provider: ${provider}`);
}
