import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';
import { refreshOpenAIToken } from '../../auth/src/openai-oauth.ts';
import { setAuth, getAuth } from '../../auth/src/index.ts';
import os from 'node:os';

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

export type OpenAIOAuthConfig = {
	oauth: OAuth;
	projectRoot?: string;
};

async function refreshAndPersist(
	oauth: OAuth,
	projectRoot?: string,
): Promise<OAuth> {
	const newTokens = await refreshOpenAIToken(oauth.refresh);
	const updated: OAuth = {
		type: 'oauth',
		access: newTokens.access,
		refresh: newTokens.refresh,
		expires: newTokens.expires,
		accountId: oauth.accountId,
		idToken: newTokens.idToken,
	};
	await setAuth('openai', updated, projectRoot, 'global');
	return updated;
}

async function ensureValidToken(
	oauth: OAuth,
	projectRoot?: string,
): Promise<{ oauth: OAuth; access: string; accountId?: string }> {
	if (oauth.access && oauth.expires > Date.now()) {
		return { oauth, access: oauth.access, accountId: oauth.accountId };
	}

	try {
		const updated = await refreshAndPersist(oauth, projectRoot);
		return {
			oauth: updated,
			access: updated.access,
			accountId: updated.accountId,
		};
	} catch {
		console.error(
			'[openai-oauth] Token refresh failed, falling back to expired token',
		);
		return { oauth, access: oauth.access, accountId: oauth.accountId };
	}
}

function rewriteUrl(url: string): string {
	const parsed = new URL(url);
	if (
		parsed.pathname.includes('/v1/responses') ||
		parsed.pathname.includes('/chat/completions')
	) {
		return CODEX_RESPONSES_URL;
	}
	return url;
}

function buildHeaders(
	init: RequestInit | undefined,
	accessToken: string,
	accountId?: string,
): Headers {
	const headers = new Headers(init?.headers);
	headers.delete('Authorization');
	headers.delete('authorization');
	headers.set('authorization', `Bearer ${accessToken}`);
	headers.set('originator', 'codex_cli_rs');
	headers.set('version', '0.98.0');
	headers.set('x-oai-web-search-eligible', 'true');
	headers.set('accept', 'text/event-stream');
	headers.set(
		'User-Agent',
		`codex_cli_rs/0.98.0 (${os.platform()} ${os.release()}; ${os.arch()})`,
	);
	if (accountId) {
		headers.set('ChatGPT-Account-Id', accountId);
	}
	return headers;
}

export function createOpenAIOAuthFetch(config: OpenAIOAuthConfig) {
	let currentOAuth = config.oauth;

	const customFetch = async (
		input: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	): Promise<Response> => {
		const validated = await ensureValidToken(currentOAuth, config.projectRoot);
		currentOAuth = validated.oauth;

		const originalUrl =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input.url;
		const targetUrl = rewriteUrl(originalUrl);

		const headers = buildHeaders(init, validated.access, validated.accountId);
		headers.set('accept-encoding', 'identity');

		const response = await fetch(targetUrl, {
			...init,
			headers,
			// biome-ignore lint/suspicious/noTsIgnore: Bun-specific fetch option
			// @ts-ignore
			timeout: false,
			decompress: false,
		});

		if (response.status === 401) {
			try {
				const refreshedFromDisk = await getAuth('openai', config.projectRoot);
				if (
					refreshedFromDisk?.type === 'oauth' &&
					refreshedFromDisk.access !== validated.access
				) {
					currentOAuth = refreshedFromDisk;
				} else {
					currentOAuth = await refreshAndPersist(
						currentOAuth,
						config.projectRoot,
					);
				}

				const retryHeaders = buildHeaders(
					init,
					currentOAuth.access,
					currentOAuth.accountId,
				);
				retryHeaders.set('accept-encoding', 'identity');

				return fetch(targetUrl, {
					...init,
					headers: retryHeaders,
					// biome-ignore lint/suspicious/noTsIgnore: Bun-specific fetch option
					// @ts-ignore
					timeout: false,
					decompress: false,
				});
			} catch {
				console.error(
					'[openai-oauth] 401 retry failed, returning original 401 response',
				);
				return response;
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
		baseURL: CODEX_BASE_URL,
		fetch: customFetch,
	});

	return provider.responses(model);
}
