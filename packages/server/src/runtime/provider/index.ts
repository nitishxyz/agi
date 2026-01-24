import type { AGIConfig, ProviderId } from '@agi-cli/sdk';
import { getAnthropicInstance } from './anthropic.ts';
import { resolveOpenAIModel } from './openai.ts';
import { resolveGoogleModel } from './google.ts';
import { resolveOpenRouterModel } from './openrouter.ts';
import { resolveSolforgeModel } from './solforge.ts';
import { getZaiInstance, getZaiCodingInstance } from './zai.ts';
import { resolveOpencodeModel } from './opencode.ts';

export type ProviderName = ProviderId;

export async function resolveModel(
	provider: ProviderName,
	model: string,
	cfg: AGIConfig,
	options?: { systemPrompt?: string; sessionId?: string },
) {
	if (provider === 'openai') {
		return resolveOpenAIModel(model, cfg, {
			systemPrompt: options?.systemPrompt,
		});
	}
	if (provider === 'anthropic') {
		const instance = await getAnthropicInstance(cfg);
		return instance(model);
	}
	if (provider === 'google') {
		return resolveGoogleModel(model, cfg);
	}
	if (provider === 'openrouter') {
		return resolveOpenRouterModel(model);
	}
	if (provider === 'opencode') {
		return resolveOpencodeModel(model, cfg);
	}
	if (provider === 'solforge') {
		return resolveSolforgeModel(model, options?.sessionId);
	}
	if (provider === 'zai') {
		return getZaiInstance(cfg, model);
	}
	if (provider === 'zai-coding') {
		return getZaiCodingInstance(cfg, model);
	}
	throw new Error(`Unsupported provider: ${provider}`);
}
