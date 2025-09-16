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
	// Fallback to config file keys if still unset (env preferred, ensureProviderEnv sets env earlier)
	if (
		provider === 'openai' &&
		cfg.providers.openai?.apiKey &&
		!process.env.OPENAI_API_KEY
	) {
		process.env.OPENAI_API_KEY = cfg.providers.openai.apiKey;
	}
	if (
		provider === 'anthropic' &&
		cfg.providers.anthropic?.apiKey &&
		!process.env.ANTHROPIC_API_KEY
	) {
		process.env.ANTHROPIC_API_KEY = cfg.providers.anthropic.apiKey;
	}
	if (
		provider === 'google' &&
		cfg.providers.google?.apiKey &&
		!process.env.GOOGLE_GENERATIVE_AI_API_KEY
	) {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = cfg.providers.google.apiKey;
	}
	if (provider === 'openai') return openai(model);
	if (provider === 'anthropic') return anthropic(model);
	if (provider === 'google') return google(model);
	throw new Error(`Unsupported provider: ${provider}`);
}
