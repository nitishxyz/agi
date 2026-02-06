import type { ProviderId, ModelInfo } from '../../types/src/index.ts';

const OAUTH_MODEL_PREFIXES: Partial<Record<ProviderId, string[]>> = {
	anthropic: ['claude-haiku-4-5', 'claude-opus-4-5', 'claude-opus-4-6', 'claude-sonnet-4-5'],
	openai: [
		'gpt-5.2-codex',
		'gpt-5.3-codex',
		'gpt-5.1-codex-max',
		'gpt-5.1-codex-mini',
		'gpt-5.2',
	],
};

export function isModelAllowedForOAuth(
	provider: ProviderId,
	modelId: string,
): boolean {
	const prefixes = OAUTH_MODEL_PREFIXES[provider];
	if (!prefixes) return true;
	return prefixes.some((prefix) => modelId.startsWith(prefix));
}

export function filterModelsForAuthType(
	provider: ProviderId,
	models: ModelInfo[],
	authType: 'api' | 'oauth' | 'wallet' | undefined,
): ModelInfo[] {
	if (authType !== 'oauth') return models;
	const prefixes = OAUTH_MODEL_PREFIXES[provider];
	if (!prefixes) return models;
	return models.filter((m) =>
		prefixes.some((prefix) => m.id.startsWith(prefix)),
	);
}

export function getOAuthModelPrefixes(
	provider: ProviderId,
): string[] | undefined {
	return OAUTH_MODEL_PREFIXES[provider];
}
