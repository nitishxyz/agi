import type { AGIConfig, ProviderId } from '@agi-cli/sdk';
import {
	catalog,
	createSolforgeModel,
	createOpenAIOAuthModel,
	getAuth,
	refreshToken,
	setAuth,
} from '@agi-cli/sdk';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { toClaudeCodeName } from '../tools/mapping.ts';

// Version to report in user-agent for Claude Code compatibility
const CLAUDE_CLI_VERSION = '1.0.61';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type ProviderName = ProviderId;

async function getZaiInstance(cfg: AGIConfig, model: string) {
	const auth = await getAuth('zai', cfg.projectRoot);
	const entry = catalog.zai;

	let apiKey = '';
	const baseURL = entry?.api || 'https://api.z.ai/api/paas/v4';

	if (auth?.type === 'api' && auth.key) {
		apiKey = auth.key;
	} else {
		apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || '';
	}

	const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

	const instance = createOpenAICompatible({
		name: entry?.label ?? 'Z.AI',
		baseURL,
		headers,
	});

	return instance(model);
}

async function getZaiCodingInstance(cfg: AGIConfig, model: string) {
	const auth =
		(await getAuth('zai', cfg.projectRoot)) ||
		(await getAuth('zai-coding', cfg.projectRoot));
	const entry = catalog['zai-coding'];

	let apiKey = '';
	const baseURL = entry?.api || 'https://api.z.ai/api/coding/paas/v4';

	if (auth?.type === 'api' && auth.key) {
		apiKey = auth.key;
	} else {
		apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || '';
	}

	const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

	const instance = createOpenAICompatible({
		name: entry?.label ?? 'Z.AI Coding',
		baseURL,
		headers,
	});

	return instance(model);
}

function getOpenRouterInstance() {
	const apiKey = process.env.OPENROUTER_API_KEY ?? '';
	return createOpenRouter({ apiKey });
}

async function getAnthropicInstance(cfg: AGIConfig) {
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

			// Required Claude Code headers
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

			// Stainless headers (fingerprinting)
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

			// Add ?beta=true to URL
			let url = typeof input === 'string' ? input : input.toString();
			if (url.includes('/v1/messages') && !url.includes('beta=true')) {
				url += url.includes('?') ? '&beta=true' : '?beta=true';
			}

			// Transform request body: tool names to PascalCase + apply caching
			let body = init?.body;
			if (body && typeof body === 'string') {
				try {
					const parsed = JSON.parse(body);

					// Transform tool names
					if (parsed.tools && Array.isArray(parsed.tools)) {
						parsed.tools = parsed.tools.map(
							(tool: { name: string; [key: string]: unknown }) => ({
								...tool,
								name: toClaudeCodeName(tool.name),
							}),
						);
					}

					// Apply ephemeral caching (max 4 cache breakpoints total)
					// Adapter adds 2 tool cache blocks, so we can add 2 more:
					// - 1 system block (the first one with tools description)
					// - 1 message block (the last user message)
					const MAX_SYSTEM_CACHE = 1;
					const MAX_MESSAGE_CACHE = 1;
					let systemCacheUsed = 0;
					let messageCacheUsed = 0;

					// Cache first system message only (contains agent instructions)
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

					// Transform tool names in messages and apply caching to last message only
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
								// Only cache the very last message
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

											// Transform tool names
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

											// Add cache_control to last block of last message
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

								// For string content, wrap in array with cache_control if last message
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

	// For API key auth, also apply caching via customFetch
	// This optimizes token usage even without OAuth
	const customFetch = async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		let body = init?.body;
		if (body && typeof body === 'string') {
			try {
				const parsed = JSON.parse(body);

				// Apply ephemeral caching (max 4 cache breakpoints total)
				// Adapter adds 2 tool cache blocks, so we can add 2 more:
				// - 1 system block + 1 message block = 2
				const MAX_SYSTEM_CACHE = 1;
				const MAX_MESSAGE_CACHE = 1;
				let systemCacheUsed = 0;
				let messageCacheUsed = 0;

				// Cache first system message
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

				// Cache last message only
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

export async function resolveModel(
	provider: ProviderName,
	model: string,
	cfg: AGIConfig,
	options?: { systemPrompt?: string },
) {
	if (provider === 'openai') {
		const auth = await getAuth('openai', cfg.projectRoot);
		if (auth?.type === 'oauth') {
			const isCodexModel = model.toLowerCase().includes('codex');
			return createOpenAIOAuthModel(model, {
				oauth: auth,
				projectRoot: cfg.projectRoot,
				reasoningEffort: isCodexModel ? 'high' : 'medium',
				reasoningSummary: 'auto',
				instructions: options?.systemPrompt,
			});
		}
		if (auth?.type === 'api' && auth.key) {
			const instance = createOpenAI({ apiKey: auth.key });
			return instance(model);
		}
		return openai(model);
	}
	if (provider === 'anthropic') {
		const instance = await getAnthropicInstance(cfg);
		return instance(model);
	}
	if (provider === 'google') {
		const auth = await getAuth('google', cfg.projectRoot);
		if (auth?.type === 'api' && auth.key) {
			const instance = createGoogleGenerativeAI({ apiKey: auth.key });
			return instance(model);
		}
		return google(model);
	}
	if (provider === 'openrouter') {
		const openrouter = getOpenRouterInstance();
		return openrouter.chat(model);
	}
	if (provider === 'opencode') {
		const entry = catalog[provider];
		const normalizedModel = normalizeModelIdentifier(provider, model);
		const modelInfo =
			entry?.models.find((m) => m.id === normalizedModel) ??
			entry?.models.find((m) => m.id === model);
		const resolvedModelId = modelInfo?.id ?? normalizedModel ?? model;
		const binding = modelInfo?.provider?.npm ?? entry?.npm;
		const apiKey = process.env.OPENCODE_API_KEY ?? '';
		const baseURL =
			modelInfo?.provider?.baseURL ||
			modelInfo?.provider?.api ||
			entry?.api ||
			'https://opencode.ai/zen/v1';
		const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
		if (binding === '@ai-sdk/openai') {
			const instance = createOpenAI({ apiKey, baseURL });
			return instance(resolvedModelId);
		}
		if (binding === '@ai-sdk/anthropic') {
			const instance = createAnthropic({ apiKey, baseURL });
			return instance(resolvedModelId);
		}
		if (binding === '@ai-sdk/openai-compatible') {
			const instance = createOpenAICompatible({
				name: entry?.label ?? 'opencode',
				baseURL,
				headers,
			});
			return instance(resolvedModelId);
		}

		const ocOpenAI = createOpenAI({ apiKey, baseURL });
		const ocAnthropic = createAnthropic({ apiKey, baseURL });
		const ocCompat = createOpenAICompatible({
			name: entry?.label ?? 'opencode',
			baseURL,
			headers,
		});

		const id = resolvedModelId.toLowerCase();
		if (id.includes('claude')) return ocAnthropic(resolvedModelId);
		if (
			id.includes('qwen3-coder') ||
			id.includes('grok-code') ||
			id.includes('kimi-k2')
		)
			return ocCompat(resolvedModelId);
		return ocOpenAI(resolvedModelId);
	}
	if (provider === 'solforge') {
		const privateKey = process.env.SOLFORGE_PRIVATE_KEY ?? '';
		if (!privateKey) {
			throw new Error(
				'Solforge provider requires SOLFORGE_PRIVATE_KEY (base58 Solana secret).',
			);
		}
		const baseURL = process.env.SOLFORGE_BASE_URL;
		const rpcURL = process.env.SOLFORGE_SOLANA_RPC_URL;
		const topupAmount = process.env.SOLFORGE_TOPUP_MICRO_USDC;
		return createSolforgeModel(
			model,
			{ privateKey },
			{
				baseURL,
				rpcURL,
				topupAmountMicroUsdc: topupAmount,
			},
		);
	}
	if (provider === 'zai') {
		return getZaiInstance(cfg, model);
	}
	if (provider === 'zai-coding') {
		return getZaiCodingInstance(cfg, model);
	}
	throw new Error(`Unsupported provider: ${provider}`);
}

function normalizeModelIdentifier(provider: ProviderId, model: string): string {
	const prefix = `${provider}/`;
	return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}
