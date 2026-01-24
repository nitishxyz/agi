import { createAnthropic } from '@ai-sdk/anthropic';
import { addAnthropicCacheControl } from './anthropic-caching.ts';

const CLAUDE_CLI_VERSION = '1.0.61';

export type AnthropicOAuthConfig = {
	oauth: {
		access: string;
		refresh: string;
		expires: number;
	};
	toolNameTransformer?: (name: string) => string;
};

function buildOAuthHeaders(accessToken: string): Record<string, string> {
	const headers: Record<string, string> = {
		authorization: `Bearer ${accessToken}`,
		'anthropic-beta':
			'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14',
		'anthropic-dangerous-direct-browser-access': 'true',
		'anthropic-version': '2023-06-01',
		'user-agent': `claude-cli/${CLAUDE_CLI_VERSION} (external, cli)`,
		'x-app': 'cli',
		'content-type': 'application/json',
		accept: 'application/json',
		'x-stainless-arch': process.arch === 'arm64' ? 'arm64' : 'x64',
		'x-stainless-helper-method': 'stream',
		'x-stainless-lang': 'js',
		'x-stainless-os':
			process.platform === 'darwin'
				? 'MacOS'
				: process.platform === 'win32'
					? 'Windows'
					: 'Linux',
		'x-stainless-package-version': '0.70.0',
		'x-stainless-retry-count': '0',
		'x-stainless-runtime': 'node',
		'x-stainless-runtime-version': process.version,
		'x-stainless-timeout': '600',
	};
	return headers;
}

function filterExistingHeaders(
	initHeaders: HeadersInit | undefined,
): Record<string, string> {
	const headers: Record<string, string> = {};
	if (!initHeaders) return headers;

	if (initHeaders instanceof Headers) {
		initHeaders.forEach((value, key) => {
			if (key.toLowerCase() !== 'x-api-key') {
				headers[key] = value;
			}
		});
	} else if (Array.isArray(initHeaders)) {
		for (const [key, value] of initHeaders) {
			if (key && key.toLowerCase() !== 'x-api-key' && typeof value === 'string') {
				headers[key] = value;
			}
		}
	} else {
		for (const [key, value] of Object.entries(initHeaders)) {
			if (key.toLowerCase() !== 'x-api-key' && typeof value === 'string') {
				headers[key] = value;
			}
		}
	}
	return headers;
}

export function createAnthropicOAuthFetch(config: AnthropicOAuthConfig): typeof fetch {
	const { oauth, toolNameTransformer } = config;

	return async (input: string | URL | Request, init?: RequestInit) => {
		const existingHeaders = filterExistingHeaders(init?.headers);
		const oauthHeaders = buildOAuthHeaders(oauth.access);
		const headers = { ...existingHeaders, ...oauthHeaders };

		let url = typeof input === 'string' ? input : input.toString();
		if (url.includes('/v1/messages') && !url.includes('beta=true')) {
			url += url.includes('?') ? '&beta=true' : '?beta=true';
		}

		let body = init?.body;
		if (body && typeof body === 'string') {
			try {
				const parsed = JSON.parse(body);

				if (toolNameTransformer) {
					if (parsed.tools && Array.isArray(parsed.tools)) {
						parsed.tools = parsed.tools.map(
							(tool: { name: string; [key: string]: unknown }) => ({
								...tool,
								name: toolNameTransformer(tool.name),
							}),
						);
					}

					if (parsed.messages && Array.isArray(parsed.messages)) {
						parsed.messages = parsed.messages.map(
							(msg: { content: unknown; [key: string]: unknown }) => {
								if (Array.isArray(msg.content)) {
									const content = msg.content.map(
										(block: { type: string; name?: string; [key: string]: unknown }) => {
											if ((block.type === 'tool_use' || block.type === 'tool_result') && block.name) {
												return { ...block, name: toolNameTransformer(block.name) };
											}
											return block;
										},
									);
									return { ...msg, content };
								}
								return msg;
							},
						);
					}
				}

				const withCache = addAnthropicCacheControl(parsed);
				body = JSON.stringify(withCache);
			} catch {
				// If parsing fails, send as-is
			}
		}

		return fetch(url, { ...init, body, headers });
	};
}

export function createAnthropicOAuthModel(
	model: string,
	config: AnthropicOAuthConfig,
) {
	const customFetch = createAnthropicOAuthFetch(config);
	return createAnthropic({
		apiKey: '',
		fetch: customFetch as typeof fetch,
	})(model);
}
