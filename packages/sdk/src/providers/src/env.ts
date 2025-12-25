import type { ProviderId } from '../../types/src/index.ts';

const ENV_VARS: Record<ProviderId, string> = {
	openai: 'OPENAI_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	google: 'GOOGLE_GENERATIVE_AI_API_KEY',
	openrouter: 'OPENROUTER_API_KEY',
	opencode: 'OPENCODE_API_KEY',
	solforge: 'SOLFORGE_PRIVATE_KEY',
	zai: 'ZAI_API_KEY',
	'zai-coding': 'ZAI_API_KEY',
};

export function providerEnvVar(provider: ProviderId): string {
	return ENV_VARS[provider];
}

export function readEnvKey(provider: ProviderId): string | undefined {
	const key = providerEnvVar(provider);
	const value = process.env[key];
	return value?.length ? value : undefined;
}

export function setEnvKey(provider: ProviderId, value: string | undefined) {
	const key = providerEnvVar(provider);
	if (value) {
		process.env[key] = value;
	}
}
