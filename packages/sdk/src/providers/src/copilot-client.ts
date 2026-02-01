import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { OAuth } from '../../types/src/index.ts';

const COPILOT_BASE_URL = 'https://api.githubcopilot.com';

export type CopilotOAuthConfig = {
	oauth: OAuth;
};

export function createCopilotFetch(config: CopilotOAuthConfig): typeof fetch {
	return async (
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> => {
		const headers = new Headers(init?.headers);
		headers.delete('Authorization');
		headers.delete('authorization');
		headers.set('Authorization', `Bearer ${config.oauth.refresh}`);
		headers.set('Openai-Intent', 'conversation-edits');
		headers.set('User-Agent', 'agi-cli');

		return fetch(input, {
			...init,
			headers,
		});
	};
}

export function createCopilotModel(model: string, config: CopilotOAuthConfig) {
	const customFetch = createCopilotFetch(config);

	const provider = createOpenAICompatible({
		name: 'github-copilot',
		baseURL: COPILOT_BASE_URL,
		apiKey: 'copilot-oauth',
		fetch: customFetch,
	});

	return provider.chatModel(model);
}
