import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';
import { refreshOpenAIToken } from '../../auth/src/openai-oauth.ts';
import { setAuth, getAuth } from '../../auth/src/index.ts';

const CHATGPT_BACKEND_URL = 'https://chatgpt.com/backend-api';
const OPENAI_API_URL = 'https://api.openai.com/v1';

const DEFAULT_INSTRUCTIONS = `You are a helpful coding assistant. Be concise and direct.`;

export type OpenAIOAuthConfig = {
	oauth: OAuth;
	projectRoot?: string;
	instructions?: string;
	reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
	reasoningSummary?: 'auto' | 'detailed';
};

async function ensureValidToken(
	oauth: OAuth,
	projectRoot?: string,
): Promise<{ access: string; accountId?: string }> {
	const bufferMs = 5 * 60 * 1000;
	if (oauth.expires > Date.now() + bufferMs) {
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

function stripIdsFromInput(input: unknown): unknown {
	if (Array.isArray(input)) {
		const filtered = input.filter((item) => {
			if (item && typeof item === 'object' && 'type' in item) {
				if (item.type === 'item_reference') return false;
			}
			return true;
		});

		const validCallIds = new Set<string>();
		for (const item of filtered) {
			if (
				item &&
				typeof item === 'object' &&
				'type' in item &&
				item.type === 'function_call' &&
				'call_id' in item &&
				typeof item.call_id === 'string'
			) {
				validCallIds.add(item.call_id);
			}
		}

		return filtered
			.filter((item) => {
				if (
					item &&
					typeof item === 'object' &&
					'type' in item &&
					item.type === 'function_call_output' &&
					'call_id' in item &&
					typeof item.call_id === 'string'
				) {
					return validCallIds.has(item.call_id);
				}
				return true;
			})
			.map((item) => {
				if (item && typeof item === 'object') {
					const result: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(item)) {
						if (key === 'id') continue;
						result[key] = stripIdsFromInput(value);
					}
					return result;
				}
				return item;
			});
	}
	if (input && typeof input === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input)) {
			if (key === 'id') continue;
			result[key] = stripIdsFromInput(value);
		}
		return result;
	}
	return input;
}

function rewriteUrl(url: string): string {
	if (url.includes('/responses')) {
		return url
			.replace(OPENAI_API_URL, CHATGPT_BACKEND_URL)
			.replace('/responses', '/codex/responses');
	}
	return url.replace(OPENAI_API_URL, CHATGPT_BACKEND_URL);
}

export function createOpenAIOAuthFetch(config: OpenAIOAuthConfig) {
	let currentOAuth = config.oauth;
	const instructions = config.instructions || DEFAULT_INSTRUCTIONS;

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

		let body = init?.body;
		if (body && typeof body === 'string') {
			try {
				const parsed = JSON.parse(body);

				parsed.store = false;
				// ChatGPT backend codex endpoint requires streaming
				parsed.stream = true;
				parsed.instructions = instructions;

				if (parsed.input) {
					parsed.input = stripIdsFromInput(parsed.input);
				}

				if (!parsed.include) {
					parsed.include = ['reasoning.encrypted_content'];
				} else if (
					Array.isArray(parsed.include) &&
					!parsed.include.includes('reasoning.encrypted_content')
				) {
					parsed.include.push('reasoning.encrypted_content');
				}

				if (!parsed.reasoning) {
					const providerOpts = parsed.providerOptions?.openai || {};
					parsed.reasoning = {
						effort:
							providerOpts.reasoningEffort ||
							config.reasoningEffort ||
							'medium',
						summary:
							providerOpts.reasoningSummary ||
							config.reasoningSummary ||
							'auto',
					};
				} else {
					const providerOpts = parsed.providerOptions?.openai || {};
					if (!parsed.reasoning.effort) {
						parsed.reasoning.effort =
							providerOpts.reasoningEffort ||
							config.reasoningEffort ||
							'medium';
					}
				if (!parsed.reasoning.summary) {
					parsed.reasoning.summary =
						providerOpts.reasoningSummary ||
						config.reasoningSummary ||
						'auto';
				}
			}

			delete parsed.max_output_tokens;
			delete parsed.max_completion_tokens;

				body = JSON.stringify(parsed);
			} catch {}
		}

		const headers = new Headers(init?.headers);
		headers.delete('x-api-key');
		headers.set('Authorization', `Bearer ${accessToken}`);
		headers.set('OpenAI-Beta', 'responses=experimental');
		headers.set('originator', 'codex_cli_rs');
		headers.set('accept', 'text/event-stream');
		if (accountId) {
			headers.set('chatgpt-account-id', accountId);
		}

		const response = await fetch(targetUrl, {
			...init,
			body,
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
		baseURL: CHATGPT_BACKEND_URL,
		fetch: customFetch,
	});

	return provider(model);
}
