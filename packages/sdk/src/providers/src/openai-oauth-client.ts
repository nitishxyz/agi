import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';
import { refreshOpenAIToken } from '../../auth/src/openai-oauth.ts';
import { setAuth, getAuth } from '../../auth/src/index.ts';
import os from 'node:os';

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_MAX_RETRIES = 2;
const TOKEN_REFRESH_RETRY_DELAY_MS = 1000;

export type OpenAIOAuthConfig = {
	oauth: OAuth;
	projectRoot?: string;
	sessionId?: string;
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAndPersist(
	oauth: OAuth,
	projectRoot?: string,
): Promise<OAuth> {
	let lastError: Error | undefined;
	for (let attempt = 0; attempt <= TOKEN_REFRESH_MAX_RETRIES; attempt++) {
		try {
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
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			if (attempt < TOKEN_REFRESH_MAX_RETRIES) {
				await sleep(TOKEN_REFRESH_RETRY_DELAY_MS * (attempt + 1));
			}
		}
	}
	throw lastError ?? new Error('Token refresh failed');
}

async function ensureValidToken(
	oauth: OAuth,
	projectRoot?: string,
): Promise<{ oauth: OAuth; access: string; accountId?: string }> {
	if (oauth.access && oauth.expires > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
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
			'[openai-oauth] Token refresh failed after retries, falling back to current token',
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
	sessionId?: string,
): Headers {
	const headers = new Headers(init?.headers);
	headers.delete('Authorization');
	headers.delete('authorization');
	headers.set('authorization', `Bearer ${accessToken}`);
	headers.set('originator', 'otto');
	headers.set(
		'User-Agent',
		`otto/1.0 (${os.platform()} ${os.release()}; ${os.arch()})`,
	);
	if (accountId) {
		headers.set('ChatGPT-Account-Id', accountId);
	}
	if (sessionId) {
		headers.set('session_id', sessionId);
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

		const headers = buildHeaders(
			init,
			validated.access,
			validated.accountId,
			config.sessionId,
		);

		const response = await fetch(targetUrl, {
			...init,
			headers,
			// biome-ignore lint/suspicious/noTsIgnore: Bun-specific fetch option
			// @ts-ignore
			timeout: false,
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
					config.sessionId,
				);

				return fetch(targetUrl, {
					...init,
					headers: retryHeaders,
					// biome-ignore lint/suspicious/noTsIgnore: Bun-specific fetch option
					// @ts-ignore
					timeout: false,
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
