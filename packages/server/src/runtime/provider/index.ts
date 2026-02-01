import type { AGIConfig, ProviderId } from '@agi-cli/sdk';
import { getAnthropicInstance } from './anthropic.ts';
import { resolveOpenAIModel } from './openai.ts';
import { resolveGoogleModel } from './google.ts';
import { resolveOpenRouterModel } from './openrouter.ts';
import { resolveSetuModel, type ResolveSetuModelOptions } from './setu.ts';
import { getZaiInstance, getZaiCodingInstance } from './zai.ts';
import { resolveOpencodeModel } from './opencode.ts';
import { getMoonshotInstance } from './moonshot.ts';
import { resolveCopilotModel } from './copilot.ts';

export type ProviderName = ProviderId;

export async function resolveModel(
	provider: ProviderName,
	model: string,
	cfg: AGIConfig,
	options?: {
		systemPrompt?: string;
		sessionId?: string;
		messageId?: string;
		topupApprovalMode?: ResolveSetuModelOptions['topupApprovalMode'];
	},
) {
	if (provider === 'openai') {
		return resolveOpenAIModel(model, cfg);
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
	if (provider === 'copilot') {
		return resolveCopilotModel(model, cfg);
	}
	if (provider === 'setu') {
		return await resolveSetuModel(model, options?.sessionId, {
			messageId: options?.messageId,
			topupApprovalMode: options?.topupApprovalMode,
		});
	}
	if (provider === 'zai') {
		return getZaiInstance(cfg, model);
	}
	if (provider === 'zai-coding') {
		return getZaiCodingInstance(cfg, model);
	}
	if (provider === 'moonshot') {
		return getMoonshotInstance(cfg, model);
	}
	throw new Error(`Unsupported provider: ${provider}`);
}
