import { createOpenAI } from '@ai-sdk/openai';
import type { OAuth } from '../../types/src/index.ts';

const COPILOT_BASE_URL = 'https://api.githubcopilot.com';

export type CopilotOAuthConfig = {
	oauth: OAuth;
};

function shouldDropCopilotReasoningEvent(payload: unknown): boolean {
	if (!payload || typeof payload !== 'object') return false;

	const record = payload as Record<string, unknown>;
	const type = typeof record.type === 'string' ? record.type : '';
	if (!type) return false;

	if (type.startsWith('response.reasoning_')) return true;

	if (
		(type === 'response.output_item.added' ||
			type === 'response.output_item.done') &&
		record.item &&
		typeof record.item === 'object'
	) {
		const item = record.item as Record<string, unknown>;
		return item.type === 'reasoning';
	}

	return false;
}

function filterCopilotResponsesSseEvent(rawEvent: string): string | null {
	if (!rawEvent.trim()) return rawEvent;

	const dataLines: string[] = [];
	for (const line of rawEvent.split('\n')) {
		if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trimStart());
		}
	}

	if (!dataLines.length) return rawEvent;

	const data = dataLines.join('\n');
	if (data === '[DONE]') return rawEvent;

	try {
		const parsed = JSON.parse(data) as unknown;
		if (shouldDropCopilotReasoningEvent(parsed)) {
			return null;
		}
	} catch {
		return rawEvent;
	}

	return rawEvent;
}

function isDoneSseEvent(rawEvent: string): boolean {
	if (!rawEvent.trim()) return false;

	const dataLines: string[] = [];
	for (const line of rawEvent.split('\n')) {
		if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trimStart());
		}
	}

	if (!dataLines.length) return false;
	return dataLines.join('\n') === '[DONE]';
}

function sanitizeCopilotResponsesStream(response: Response): Response {
	if (!response.body) return response;

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';
	let doneEventSeen = false;

	const emitFilteredEvent = (
		rawEvent: string,
		controller: ReadableStreamDefaultController<Uint8Array>,
	) => {
		const filtered = filterCopilotResponsesSseEvent(rawEvent);
		if (filtered === null) return;
		if (isDoneSseEvent(filtered)) {
			doneEventSeen = true;
		}
		controller.enqueue(encoder.encode(`${filtered}\n\n`));
	};

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await reader.read();

			if (done) {
				buffer += decoder.decode().replace(/\r\n/g, '\n');

				if (buffer.length > 0) {
					buffer = `${buffer}\n\n`;
				}

				let boundary = buffer.indexOf('\n\n');
				while (boundary !== -1) {
					const rawEvent = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 2);
					emitFilteredEvent(rawEvent, controller);
					boundary = buffer.indexOf('\n\n');
				}

				if (!doneEventSeen) {
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				}
				controller.close();
				return;
			}

			buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

			let boundary = buffer.indexOf('\n\n');
			while (boundary !== -1) {
				const rawEvent = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);
				emitFilteredEvent(rawEvent, controller);
				boundary = buffer.indexOf('\n\n');
			}
		},
		cancel(reason) {
			void reader.cancel(reason);
		},
	});

	return new Response(stream, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

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
		headers.set('User-Agent', 'ottocode');

		const response = await fetch(input, {
			...init,
			headers,
		});

		const requestUrl =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input.url;

		if (requestUrl.includes('/responses') && response.ok) {
			return sanitizeCopilotResponsesStream(response);
		}

		return response;
	};
}

function needsResponsesApi(model: string): boolean {
	const normalized = model.toLowerCase();
	if (normalized.includes('codex')) return true;
	if (normalized.startsWith('gpt-5')) return true;
	if (normalized.startsWith('o1')) return true;
	if (normalized.startsWith('o3')) return true;
	if (normalized.startsWith('o4')) return true;
	return false;
}

export function createCopilotModel(model: string, config: CopilotOAuthConfig) {
	const customFetch = createCopilotFetch(config);

	const provider = createOpenAI({
		apiKey: 'copilot-oauth',
		baseURL: COPILOT_BASE_URL,
		fetch: customFetch,
	});

	return needsResponsesApi(model)
		? provider.responses(model)
		: provider.chat(model);
}
