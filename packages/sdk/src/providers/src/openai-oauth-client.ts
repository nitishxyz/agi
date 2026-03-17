import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';
import { refreshOpenAIToken } from '../../auth/src/openai-oauth.ts';
import { setAuth, getAuth } from '../../auth/src/index.ts';
import {
	debug as loggerDebug,
	warn as loggerWarn,
} from '../../core/src/utils/logger.ts';
import os from 'node:os';

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_MAX_RETRIES = 2;
const TOKEN_REFRESH_RETRY_DELAY_MS = 1000;

type OpenAIOAuthSessionState = {
	responseId?: string;
	model?: string;
	status?: string;
	incompleteReason?: string;
};

const openAIOAuthSessionState = new Map<string, OpenAIOAuthSessionState>();

export type OpenAIOAuthConfig = {
	oauth: OAuth;
	projectRoot?: string;
	sessionId?: string;
};

function shouldDebugOpenAIOAuth() {
	return (
		process.env.OTTO_DEBUG === '1' ||
		process.env.OTTO_DEBUG_OPENAI_OAUTH === '1'
	);
}

function logOpenAIOAuth(message: string) {
	if (shouldDebugOpenAIOAuth()) {
		loggerDebug(`[openai-oauth] ${message}`);
	}
}

function shouldUsePreviousResponseId() {
	return process.env.OTTO_OPENAI_OAUTH_PREVIOUS_RESPONSE_ID === '1';
}

export function clearOpenAIOAuthSessionState(sessionId?: string) {
	if (sessionId) {
		openAIOAuthSessionState.delete(sessionId);
		return;
	}
	openAIOAuthSessionState.clear();
}

export function getOpenAIOAuthSessionState(sessionId: string) {
	const state = openAIOAuthSessionState.get(sessionId);
	return state ? { ...state } : undefined;
}

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
		loggerWarn(
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

function readSessionState(sessionId?: string) {
	if (!sessionId) return undefined;
	return openAIOAuthSessionState.get(sessionId);
}

function writeSessionState(sessionId: string, next: OpenAIOAuthSessionState) {
	openAIOAuthSessionState.set(sessionId, next);
}

function rewriteRequestBody(
	body: string,
	sessionId?: string,
): { body: string; previousResponseId?: string; model?: string } {
	try {
		const parsed = JSON.parse(body) as Record<string, unknown>;
		const model = typeof parsed.model === 'string' ? parsed.model : undefined;
		if (!sessionId) {
			return { body, model };
		}

		const prior = readSessionState(sessionId);
		if (
			prior?.responseId &&
			!parsed.previous_response_id &&
			(!prior.model || !model || prior.model === model)
		) {
			if (!shouldUsePreviousResponseId()) {
				logOpenAIOAuth(
					`not injecting previous_response_id=${prior.responseId} for session=${sessionId} model=${model ?? 'unknown'} because Codex HTTP backend rejects it; enable OTTO_OPENAI_OAUTH_PREVIOUS_RESPONSE_ID=1 only for validation`,
				);
				return { body, model };
			}
			parsed.previous_response_id = prior.responseId;
			logOpenAIOAuth(
				`injecting previous_response_id=${prior.responseId} for session=${sessionId} model=${model ?? 'unknown'}`,
			);
			return {
				body: JSON.stringify(parsed),
				previousResponseId: prior.responseId,
				model,
			};
		}

		return { body, model };
	} catch {
		return { body };
	}
}

function previewText(value: unknown, maxLength = 240): string | undefined {
	if (typeof value !== 'string') return undefined;
	const normalized = value.replace(/\s+/g, ' ').trim();
	if (!normalized) return undefined;
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength)}…`
		: normalized;
}

function summarizeRequestBody(body: string): string {
	try {
		const parsed = JSON.parse(body) as Record<string, unknown>;
		const input = Array.isArray(parsed.input) ? parsed.input : [];
		const systemMessages = input.filter((item) => {
			if (!item || typeof item !== 'object') return false;
			const role = (item as Record<string, unknown>).role;
			return role === 'system';
		});
		const systemPreview = previewText(
			(systemMessages[0] as Record<string, unknown> | undefined)?.content,
		);
		const instructionsPreview = previewText(parsed.instructions);
		return [
			`model=${typeof parsed.model === 'string' ? parsed.model : 'unknown'}`,
			`instructionsPresent=${typeof parsed.instructions === 'string'}`,
			`instructionsPreview=${instructionsPreview ?? 'none'}`,
			`inputCount=${input.length}`,
			`systemMessageCount=${systemMessages.length}`,
			`firstSystemPreview=${systemPreview ?? 'none'}`,
			`previousResponseId=${typeof parsed.previous_response_id === 'string' ? parsed.previous_response_id : 'none'}`,
		].join(' ');
	} catch {
		return 'unparseable-body';
	}
}

function trackResponseEvent(data: string, sessionId?: string) {
	if (!sessionId) return;

	try {
		const parsed = JSON.parse(data) as Record<string, unknown>;
		const type = typeof parsed.type === 'string' ? parsed.type : undefined;
		const response =
			parsed.response && typeof parsed.response === 'object'
				? (parsed.response as Record<string, unknown>)
				: undefined;
		const responseId =
			typeof response?.id === 'string'
				? response.id
				: typeof parsed.response_id === 'string'
					? parsed.response_id
					: undefined;
		const responseModel =
			typeof response?.model === 'string' ? response.model : undefined;
		const responseStatus =
			typeof response?.status === 'string' ? response.status : undefined;
		const incompleteReason =
			response?.incomplete_details &&
			typeof response.incomplete_details === 'object' &&
			typeof (response.incomplete_details as Record<string, unknown>).reason ===
				'string'
				? ((response.incomplete_details as Record<string, unknown>)
						.reason as string)
				: undefined;

		if (responseId) {
			const prior = readSessionState(sessionId);
			writeSessionState(sessionId, {
				responseId,
				model: responseModel ?? prior?.model,
				status: responseStatus ?? type,
				incompleteReason,
			});
			logOpenAIOAuth(
				`tracked response event type=${type ?? 'unknown'} responseId=${responseId} session=${sessionId} status=${responseStatus ?? 'unknown'} incompleteReason=${incompleteReason ?? 'none'}`,
			);
		}
	} catch {
		// ignore non-JSON data chunks
	}
}

function trackResponsesStream(
	response: Response,
	sessionId?: string,
): Response {
	if (!response.body || !sessionId) {
		return response;
	}

	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';

	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
			let boundary = buffer.indexOf('\n\n');
			while (boundary !== -1) {
				const rawEvent = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);

				const dataLines: string[] = [];
				for (const line of rawEvent.split('\n')) {
					if (line.startsWith('data:')) {
						dataLines.push(line.slice('data:'.length).trimStart());
					}
				}
				const data = dataLines.join('\n');
				if (data && data !== '[DONE]') {
					trackResponseEvent(data, sessionId);
				}

				controller.enqueue(encoder.encode(`${rawEvent}\n\n`));
				boundary = buffer.indexOf('\n\n');
			}
		},
		flush(controller) {
			buffer += decoder.decode().replace(/\r\n/g, '\n');
			if (buffer.length > 0) {
				controller.enqueue(encoder.encode(buffer));
			}
		},
	});

	return new Response(response.body.pipeThrough(transform), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
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
		const isResponsesRequest = targetUrl === CODEX_RESPONSES_URL;
		let requestInit = init;
		let requestModel: string | undefined;
		if (isResponsesRequest && typeof init?.body === 'string') {
			const rewritten = rewriteRequestBody(init.body, config.sessionId);
			requestModel = rewritten.model;
			requestInit =
				rewritten.body !== init.body ? { ...init, body: rewritten.body } : init;
			logOpenAIOAuth(
				`request payload summary: ${summarizeRequestBody(requestInit?.body && typeof requestInit.body === 'string' ? requestInit.body : init.body)}`,
			);
			if (config.sessionId && requestModel) {
				const prior = readSessionState(config.sessionId);
				writeSessionState(config.sessionId, {
					responseId: prior?.responseId,
					model: requestModel,
					status: prior?.status,
					incompleteReason: prior?.incompleteReason,
				});
			}
		}

		const headers = buildHeaders(
			requestInit,
			validated.access,
			validated.accountId,
			config.sessionId,
		);

		const response = await fetch(targetUrl, {
			...requestInit,
			headers,
			// @ts-expect-error Bun-specific fetch option
			timeout: false,
		});
		const trackedResponse = isResponsesRequest
			? trackResponsesStream(response, config.sessionId)
			: response;

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
					requestInit,
					currentOAuth.access,
					currentOAuth.accountId,
					config.sessionId,
				);

				const retryResponse = await fetch(targetUrl, {
					...requestInit,
					headers: retryHeaders,
					// @ts-expect-error Bun-specific fetch option
					timeout: false,
				});
				return isResponsesRequest
					? trackResponsesStream(retryResponse, config.sessionId)
					: retryResponse;
			} catch {
				console.error(
					'[openai-oauth] 401 retry failed, returning original 401 response',
				);
				return response;
			}
		}

		return trackedResponse;
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
