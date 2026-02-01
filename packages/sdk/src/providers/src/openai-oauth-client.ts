import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';
import { refreshOpenAIToken } from '../../auth/src/openai-oauth.ts';
import { setAuth, getAuth } from '../../auth/src/index.ts';

const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';

export type OpenAIOAuthConfig = {
	oauth: OAuth;
	projectRoot?: string;
};

async function ensureValidToken(
	oauth: OAuth,
	projectRoot?: string,
): Promise<{ access: string; accountId?: string }> {
	if (oauth.access && oauth.expires > Date.now()) {
		return { access: oauth.access, accountId: oauth.accountId };
	}

	try {
		const newTokens = await refreshOpenAIToken(oauth.refresh);
		const updatedOAuth: OAuth = {
			type: 'oauth',
			access: newTokens.access,
			refresh: newTokens.refresh,
			expires: newTokens.expires,
			accountId: oauth.accountId,
			idToken: newTokens.idToken,
		};
		await setAuth('openai', updatedOAuth, projectRoot, 'global');
		return { access: newTokens.access, accountId: oauth.accountId };
	} catch {
		return { access: oauth.access, accountId: oauth.accountId };
	}
}

function rewriteUrl(url: string): string {
	const parsed = new URL(url);
	if (
		parsed.pathname.includes('/v1/responses') ||
		parsed.pathname.includes('/chat/completions')
	) {
		return CODEX_API_ENDPOINT;
	}
	return url;
}

export function createOpenAIOAuthFetch(config: OpenAIOAuthConfig) {
	let currentOAuth = config.oauth;

	const customFetch = async (
		input: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	): Promise<Response> => {
		const { access: accessToken, accountId } = await ensureValidToken(
			currentOAuth,
			config.projectRoot,
		);

		const originalUrl =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input.url;
		const targetUrl = rewriteUrl(originalUrl);

		const headers = new Headers(init?.headers);
		headers.delete('Authorization');
		headers.delete('authorization');
		headers.set('authorization', `Bearer ${accessToken}`);
		headers.set('originator', 'agi');
		if (accountId) {
			headers.set('ChatGPT-Account-Id', accountId);
		}

		const response = await fetch(targetUrl, {
			...init,
			headers,
		});

		if (response.status === 401) {
			const refreshed = await getAuth('openai', config.projectRoot);
			if (refreshed?.type === 'oauth') {
				currentOAuth = refreshed;
			}
		}

		return response;
	};

	return customFetch as typeof fetch;
}

export function createOpenAIOAuthModel(
	model: string,
	config: OpenAIOAuthConfig,
) {
	const customFetch = createOpenAIOAuthFetch(config);

	const provider = createOpenAI({
		apiKey: 'chatgpt-oauth',
		fetch: customFetch,
	});

	return provider.responses(model);
}
