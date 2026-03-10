import {
	catalog,
	getModelNpmBinding,
	getUnderlyingProviderKey,
	modelSupportsReasoning,
	type ProviderId,
	type ReasoningLevel,
} from '@ottocode/sdk';

const THINKING_BUDGET = 16000;

export type ReasoningConfigResult = {
	providerOptions: Record<string, unknown>;
	effectiveMaxOutputTokens: number | undefined;
	enabled: boolean;
};

function normalizeReasoningLevel(
	level: ReasoningLevel | undefined,
): Exclude<ReasoningLevel, 'xhigh'> {
	if (!level) return 'high';
	if (level === 'xhigh') return 'high';
	return level;
}

function toAnthropicEffort(
	level: ReasoningLevel | undefined,
): 'low' | 'medium' | 'high' | 'max' {
	switch (level) {
		case 'minimal':
		case 'low':
			return 'low';
		case 'medium':
			return 'medium';
		case 'max':
		case 'xhigh':
			return 'max';
		case 'high':
		default:
			return 'high';
	}
}

function toOpenAIEffort(
	level: ReasoningLevel | undefined,
): 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' {
	switch (level) {
		case 'minimal':
			return 'minimal';
		case 'low':
			return 'low';
		case 'medium':
			return 'medium';
		case 'max':
		case 'xhigh':
			return 'xhigh';
		case 'high':
		default:
			return 'high';
	}
}

function toGoogleThinkingLevel(
	level: ReasoningLevel | undefined,
): 'minimal' | 'low' | 'medium' | 'high' {
	switch (level) {
		case 'minimal':
			return 'minimal';
		case 'low':
			return 'low';
		case 'medium':
			return 'medium';
		case 'max':
		case 'xhigh':
		case 'high':
		default:
			return 'high';
	}
}

function toThinkingBudget(
	level: ReasoningLevel | undefined,
	maxOutputTokens: number | undefined,
): number {
	const cap = maxOutputTokens ? Math.max(maxOutputTokens, THINKING_BUDGET) : THINKING_BUDGET;
	switch (level) {
		case 'minimal':
			return Math.min(2048, cap);
		case 'low':
			return Math.min(4096, cap);
		case 'medium':
			return Math.min(8192, cap);
		case 'max':
		case 'xhigh':
			return Math.min(24000, cap);
		case 'high':
		default:
			return Math.min(16000, cap);
	}
}

function toCamelCaseKey(value: string): string {
	return value
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.trim()
		.split(/\s+/)
		.map((segment, index) => {
			const lower = segment.toLowerCase();
			if (index === 0) return lower;
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join('');
}

function getOpenAICompatibleProviderOptionKeys(provider: ProviderId): string[] {
	const entry = catalog[provider];
	const keys = new Set<string>(['openaiCompatible', toCamelCaseKey(provider)]);
	if (entry?.label) {
		keys.add(toCamelCaseKey(entry.label));
	}
	return Array.from(keys).filter(Boolean);
}

function buildSharedProviderOptions(
	provider: ProviderId,
	options: Record<string, unknown>,
): Record<string, unknown> {
	const keys = getOpenAICompatibleProviderOptionKeys(provider);
	return Object.fromEntries(keys.map((key) => [key, options]));
}

function usesAdaptiveAnthropicThinking(model: string): boolean {
	const lower = model.toLowerCase();
	return (
		lower.includes('claude-opus-4-6') ||
		lower.includes('claude-opus-4.6') ||
		lower.includes('claude-sonnet-4-6') ||
		lower.includes('claude-sonnet-4.6')
	);
}

function getReasoningProviderTarget(
	provider: ProviderId,
	model: string,
): 'anthropic' | 'openai' | 'google' | 'openai-compatible' | 'openrouter' | null {
	if (provider === 'openrouter') return 'openrouter';
	if (provider === 'moonshot' || provider === 'zai' || provider === 'zai-coding') {
		return 'openai-compatible';
	}
	if (provider === 'minimax') return 'anthropic';

	const npmBinding = getModelNpmBinding(provider, model);
	if (npmBinding === '@ai-sdk/anthropic') return 'anthropic';
	if (npmBinding === '@ai-sdk/openai') return 'openai';
	if (npmBinding === '@ai-sdk/google') return 'google';
	if (npmBinding === '@ai-sdk/openai-compatible') return 'openai-compatible';
	if (npmBinding === '@openrouter/ai-sdk-provider') return 'openrouter';

	const underlyingProvider = getUnderlyingProviderKey(provider, model);
	if (underlyingProvider === 'anthropic') return 'anthropic';
	if (underlyingProvider === 'openai') return 'openai';
	if (underlyingProvider === 'google') return 'google';
	if (underlyingProvider === 'openai-compatible') return 'openai-compatible';
	return null;
}

export function buildReasoningConfig(args: {
	provider: ProviderId;
	model: string;
	reasoningText?: boolean;
	reasoningLevel?: ReasoningLevel;
	maxOutputTokens: number | undefined;
}): ReasoningConfigResult {
	const { provider, model, reasoningText, reasoningLevel, maxOutputTokens } = args;
	if (!reasoningText || !modelSupportsReasoning(provider, model)) {
		return {
			providerOptions: {},
			effectiveMaxOutputTokens: maxOutputTokens,
			enabled: false,
		};
	}

	const reasoningTarget = getReasoningProviderTarget(provider, model);
	if (reasoningTarget === 'anthropic') {
		if (usesAdaptiveAnthropicThinking(model)) {
			return {
				providerOptions: {
					anthropic: {
						thinking: { type: 'adaptive' },
						effort: toAnthropicEffort(reasoningLevel),
					},
				},
				effectiveMaxOutputTokens: maxOutputTokens,
				enabled: true,
			};
		}

		const thinkingBudget = toThinkingBudget(reasoningLevel, maxOutputTokens);

		return {
			providerOptions: {
				anthropic: {
					thinking: { type: 'enabled', budgetTokens: thinkingBudget },
				},
			},
			effectiveMaxOutputTokens:
				maxOutputTokens && maxOutputTokens > thinkingBudget
					? maxOutputTokens - thinkingBudget
					: maxOutputTokens,
			enabled: true,
		};
	}

	if (reasoningTarget === 'openai') {
		return {
			providerOptions: {
				openai: {
					reasoningEffort: toOpenAIEffort(reasoningLevel),
					reasoningSummary: 'auto',
				},
			},
			effectiveMaxOutputTokens: maxOutputTokens,
			enabled: true,
		};
	}

	if (reasoningTarget === 'google') {
		const isGemini3 = model.includes('gemini-3');
		return {
			providerOptions: {
				google: {
					thinkingConfig: isGemini3
						? {
								thinkingLevel: toGoogleThinkingLevel(reasoningLevel),
								includeThoughts: true,
							}
						: {
								thinkingBudget: toThinkingBudget(reasoningLevel, maxOutputTokens),
								includeThoughts: true,
							},
				},
			},
			effectiveMaxOutputTokens: maxOutputTokens,
			enabled: true,
		};
	}

	if (reasoningTarget === 'openrouter') {
		return {
			providerOptions: {
				openrouter: {
					reasoning: { effort: normalizeReasoningLevel(reasoningLevel) },
				},
			},
			effectiveMaxOutputTokens: maxOutputTokens,
			enabled: true,
		};
	}

	if (reasoningTarget === 'openai-compatible') {
		return {
			providerOptions: buildSharedProviderOptions(provider, {
				reasoningEffort: normalizeReasoningLevel(reasoningLevel),
			}),
			effectiveMaxOutputTokens: maxOutputTokens,
			enabled: true,
		};
	}

	return {
		providerOptions: {},
		effectiveMaxOutputTokens: maxOutputTokens,
		enabled: false,
	};
}
