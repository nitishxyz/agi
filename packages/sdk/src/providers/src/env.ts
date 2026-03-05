import type { ProviderId } from '../../types/src/index.ts';

const ENV_VARS: Record<ProviderId, string> = {
	openai: 'OPENAI_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	google: 'GOOGLE_GENERATIVE_AI_API_KEY',
	openrouter: 'OPENROUTER_API_KEY',
	opencode: 'OPENCODE_API_KEY',
	copilot: 'GITHUB_TOKEN',
	setu: 'SETU_PRIVATE_KEY',
	zai: 'ZAI_API_KEY',
	'zai-coding': 'ZAI_CODING_API_KEY',
	moonshot: 'MOONSHOT_API_KEY',
	minimax: 'MINIMAX_API_KEY',
};

export function providerEnvVar(provider: ProviderId): string {
	return ENV_VARS[provider];
}

export function readEnvKey(provider: ProviderId): string | undefined {
	if (provider === 'copilot') {
		const copilotToken =
			process.env.COPILOT_GITHUB_TOKEN ??
			process.env.GH_TOKEN ??
			process.env.GITHUB_TOKEN;
		return copilotToken?.length ? copilotToken : undefined;
	}

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
