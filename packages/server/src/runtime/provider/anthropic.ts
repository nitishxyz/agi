import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth, refreshToken, setAuth } from '@agi-cli/sdk';
import { createAnthropic } from '@ai-sdk/anthropic';
import { toClaudeCodeName } from '../tools/mapping.ts';

const CLAUDE_CLI_VERSION = '1.0.61';

export async function getAnthropicInstance(cfg: AGIConfig) {
	const auth = await getAuth('anthropic', cfg.projectRoot);

	if (auth?.type === 'oauth') {
		let currentAuth = auth;

		if (currentAuth.expires < Date.now()) {
			const tokens = await refreshToken(currentAuth.refresh);
			await setAuth(
				'anthropic',
				{
					type: 'oauth',
					refresh: tokens.refresh,
					access: tokens.access,
					expires: tokens.expires,
				},
				cfg.projectRoot,
				'global',
			);
			currentAuth = {
				type: 'oauth',
				refresh: tokens.refresh,
				access: tokens.access,
				expires: tokens.expires,
			};
		}

		const customFetch = async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const initHeaders = init?.headers;
			const headers: Record<string, string> = {};

			if (initHeaders) {
				if (initHeaders instanceof Headers) {
					initHeaders.forEach((value, key) => {
						if (key.toLowerCase() !== 'x-api-key') {
							headers[key] = value;
						}
					});
				} else if (Array.isArray(initHeaders)) {
					for (const [key, value] of initHeaders) {
						if (
							key &&
							key.toLowerCase() !== 'x-api-key' &&
							typeof value === 'string'
						) {
							headers[key] = value;
						}
					}
				} else {
					for (const [key, value] of Object.entries(initHeaders)) {
						if (
							key.toLowerCase() !== 'x-api-key' &&
							typeof value === 'string'
						) {
							headers[key] = value;
						}
					}
				}
			}

			headers.authorization = `Bearer ${currentAuth.access}`;
			headers['anthropic-beta'] =
				'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14';
			headers['anthropic-dangerous-direct-browser-access'] = 'true';
			headers['anthropic-version'] = '2023-06-01';
			headers['user-agent'] =
				`claude-cli/${CLAUDE_CLI_VERSION} (external, cli)`;
			headers['x-app'] = 'cli';
			headers['content-type'] = 'application/json';
			headers.accept = 'application/json';

			headers['x-stainless-arch'] = process.arch === 'arm64' ? 'arm64' : 'x64';
			headers['x-stainless-helper-method'] = 'stream';
			headers['x-stainless-lang'] = 'js';
			headers['x-stainless-os'] =
				process.platform === 'darwin'
					? 'MacOS'
					: process.platform === 'win32'
						? 'Windows'
						: 'Linux';
			headers['x-stainless-package-version'] = '0.70.0';
			headers['x-stainless-retry-count'] = '0';
			headers['x-stainless-runtime'] = 'node';
			headers['x-stainless-runtime-version'] = process.version;
			headers['x-stainless-timeout'] = '600';

			let url = typeof input === 'string' ? input : input.toString();
			if (url.includes('/v1/messages') && !url.includes('beta=true')) {
				url += url.includes('?') ? '&beta=true' : '?beta=true';
			}

			let body = init?.body;
			if (body && typeof body === 'string') {
				try {
					const parsed = JSON.parse(body);

					if (parsed.tools && Array.isArray(parsed.tools)) {
						parsed.tools = parsed.tools.map(
							(tool: { name: string; [key: string]: unknown }) => ({
								...tool,
								name: toClaudeCodeName(tool.name),
							}),
						);
					}

					const MAX_SYSTEM_CACHE = 1;
					const MAX_MESSAGE_CACHE = 1;
					let systemCacheUsed = 0;
					let messageCacheUsed = 0;

					if (parsed.system && Array.isArray(parsed.system)) {
						parsed.system = parsed.system.map(
							(
								block: { type: string; cache_control?: unknown },
								index: number,
							) => {
								if (block.cache_control) return block;
								if (
									systemCacheUsed < MAX_SYSTEM_CACHE &&
									index === 0 &&
									block.type === 'text'
								) {
									systemCacheUsed++;
									return { ...block, cache_control: { type: 'ephemeral' } };
								}
								return block;
							},
						);
					}

					if (parsed.messages && Array.isArray(parsed.messages)) {
						const messageCount = parsed.messages.length;

						parsed.messages = parsed.messages.map(
							(
								msg: {
									role: string;
									content: unknown;
									[key: string]: unknown;
								},
								msgIndex: number,
							) => {
								const isLast = msgIndex === messageCount - 1;

								if (Array.isArray(msg.content)) {
									const content = msg.content.map(
										(
											block: {
												type: string;
												name?: string;
												cache_control?: unknown;
											},
											blockIndex: number,
										) => {
											let transformedBlock = block;

											if (block.type === 'tool_use' && block.name) {
												transformedBlock = {
													...block,
													name: toClaudeCodeName(block.name),
												};
											}
											if (block.type === 'tool_result' && block.name) {
												transformedBlock = {
													...block,
													name: toClaudeCodeName(block.name),
												};
											}

											if (
												isLast &&
												!transformedBlock.cache_control &&
												messageCacheUsed < MAX_MESSAGE_CACHE &&
												blockIndex === (msg.content as unknown[]).length - 1
											) {
												messageCacheUsed++;
												return {
													...transformedBlock,
													cache_control: { type: 'ephemeral' },
												};
											}

											return transformedBlock;
										},
									);
									return { ...msg, content };
								}

								if (
									isLast &&
									messageCacheUsed < MAX_MESSAGE_CACHE &&
									typeof msg.content === 'string'
								) {
									messageCacheUsed++;
									return {
										...msg,
										content: [
											{
												type: 'text',
												text: msg.content,
												cache_control: { type: 'ephemeral' },
											},
										],
									};
								}

								return msg;
							},
						);
					}

					body = JSON.stringify(parsed);
				} catch {
					// If parsing fails, send as-is
				}
			}

			return fetch(url, {
				...init,
				body,
				headers,
			});
		};
		return createAnthropic({
			apiKey: '',
			fetch: customFetch as typeof fetch,
		});
	}

	const customFetch = async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		let body = init?.body;
		if (body && typeof body === 'string') {
			try {
				const parsed = JSON.parse(body);

				const MAX_SYSTEM_CACHE = 1;
				const MAX_MESSAGE_CACHE = 1;
				let systemCacheUsed = 0;
				let messageCacheUsed = 0;

				if (parsed.system && Array.isArray(parsed.system)) {
					parsed.system = parsed.system.map(
						(
							block: { type: string; cache_control?: unknown },
							index: number,
						) => {
							if (block.cache_control) return block;
							if (
								systemCacheUsed < MAX_SYSTEM_CACHE &&
								index === 0 &&
								block.type === 'text'
							) {
								systemCacheUsed++;
								return { ...block, cache_control: { type: 'ephemeral' } };
							}
							return block;
						},
					);
				}

				if (parsed.messages && Array.isArray(parsed.messages)) {
					const messageCount = parsed.messages.length;
					parsed.messages = parsed.messages.map(
						(
							msg: {
								role: string;
								content: unknown;
								[key: string]: unknown;
							},
							msgIndex: number,
						) => {
							const isLast = msgIndex === messageCount - 1;

							if (Array.isArray(msg.content)) {
								const blocks = msg.content as {
									type: string;
									cache_control?: unknown;
								}[];
								const content = blocks.map((block, blockIndex) => {
									if (block.cache_control) return block;
									if (
										isLast &&
										messageCacheUsed < MAX_MESSAGE_CACHE &&
										blockIndex === blocks.length - 1
									) {
										messageCacheUsed++;
										return { ...block, cache_control: { type: 'ephemeral' } };
									}
									return block;
								});
								return { ...msg, content };
							}

							if (
								isLast &&
								messageCacheUsed < MAX_MESSAGE_CACHE &&
								typeof msg.content === 'string'
							) {
								messageCacheUsed++;
								return {
									...msg,
									content: [
										{
											type: 'text',
											text: msg.content,
											cache_control: { type: 'ephemeral' },
										},
									],
								};
							}

							return msg;
						},
					);
				}

				body = JSON.stringify(parsed);
			} catch {
				// If parsing fails, send as-is
			}
		}

		const url = typeof input === 'string' ? input : input.toString();
		return fetch(url, { ...init, body });
	};

	return createAnthropic({
		fetch: customFetch as typeof fetch,
	});
}
