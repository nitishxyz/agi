/**
 * Server-Sent Events (SSE) streaming utilities
 *
 * Provides helpers for connecting to and consuming SSE streams from the otto server.
 */

import { createParser } from 'eventsource-parser';

export interface SSEEvent {
	id?: string;
	event?: string;
	data: string;
	retry?: number;
}

export interface SSEStreamOptions {
	/**
	 * Base URL of the API server
	 */
	baseUrl: string;

	/**
	 * Session ID to stream events for
	 */
	sessionId: string;

	/**
	 * Project path (optional)
	 */
	projectPath?: string;

	/**
	 * Custom fetch implementation
	 */
	fetch?: typeof fetch;

	/**
	 * Callback for each parsed SSE event
	 */
	onEvent: (event: SSEEvent) => void;

	/**
	 * Error handler
	 */
	onError?: (error: Error) => void;

	/**
	 * Connection closed handler
	 */
	onClose?: () => void;
}

/**
 * Create an SSE stream connection to a session
 *
 * @example
 * ```typescript
 * import { createSSEStream } from '@ottocode/api';
 *
 * const controller = new AbortController();
 *
 * createSSEStream({
 *   baseUrl: 'http://localhost:9100',
 *   sessionId: 'session-123',
 *   onEvent: (event) => {
 *     console.log('Event:', event.event, event.data);
 *     const data = JSON.parse(event.data);
 *     // Handle different event types...
 *   },
 *   onError: (error) => {
 *     console.error('Stream error:', error);
 *   },
 *   onClose: () => {
 *     console.log('Stream closed');
 *   }
 * }, controller.signal);
 *
 * // Later: controller.abort() to close the stream
 * ```
 */
export async function createSSEStream(
	options: SSEStreamOptions,
	signal?: AbortSignal,
): Promise<void> {
	const {
		baseUrl,
		sessionId,
		projectPath,
		fetch: customFetch,
		onEvent,
		onError,
		onClose,
	} = options;

	const url = new URL(`${baseUrl}/v1/sessions/${sessionId}/stream`);
	if (projectPath) {
		url.searchParams.set('project', projectPath);
	}

	const fetchImpl = customFetch || fetch;

	try {
		const response = await fetchImpl(url.toString(), {
			headers: {
				Accept: 'text/event-stream',
			},
			signal,
		});

		if (!response.ok) {
			throw new Error(`Failed to connect to stream: ${response.statusText}`);
		}

		if (!response.body) {
			throw new Error('Response body is null');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		// Create SSE parser
		const parser = createParser((event) => {
			if (event.type === 'event') {
				onEvent({
					id: event.id,
					event: event.event,
					data: event.data,
				});
			}
		});

		// Read stream
		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					onClose?.();
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				parser.feed(chunk);
			}
		} finally {
			reader.releaseLock();
		}
	} catch (error) {
		if (signal?.aborted) {
			onClose?.();
		} else {
			onError?.(error as Error);
		}
	}
}

/**
 * Parse a single SSE event string
 *
 * Useful for testing or custom SSE implementations.
 */
export function parseSSEEvent(eventString: string): SSEEvent | null {
	const lines = eventString.split('\n');
	const event: Partial<SSEEvent> = {};

	for (const line of lines) {
		if (line.startsWith('id:')) {
			event.id = line.slice(3).trim();
		} else if (line.startsWith('event:')) {
			event.event = line.slice(6).trim();
		} else if (line.startsWith('data:')) {
			event.data = line.slice(5).trim();
		} else if (line.startsWith('retry:')) {
			const retry = Number.parseInt(line.slice(6).trim(), 10);
			if (!Number.isNaN(retry)) {
				event.retry = retry;
			}
		}
	}

	return event.data ? (event as SSEEvent) : null;
}

/**
 * Event type definitions for otto server SSE events
 */
export type ServerEvent =
	| SessionCreatedEvent
	| MessageCreatedEvent
	| MessagePartDeltaEvent
	| ToolCallEvent
	| ToolDeltaEvent
	| ToolResultEvent
	| MessageCompletedEvent
	| ErrorEvent;

export interface SessionCreatedEvent {
	type: 'session.created';
	sessionId: string;
	agent: string;
	provider: string;
	model: string;
}

export interface MessageCreatedEvent {
	type: 'message.created';
	messageId: string;
	role: 'user' | 'assistant';
}

export interface MessagePartDeltaEvent {
	type: 'message.part.delta';
	partId: string;
	delta: string;
}

export interface ToolCallEvent {
	type: 'tool.call';
	toolCallId: string;
	toolName: string;
	args: unknown;
}

export interface ToolDeltaEvent {
	type: 'tool.delta';
	toolCallId: string;
	delta: string;
}

export interface ToolResultEvent {
	type: 'tool.result';
	toolCallId: string;
	result: unknown;
	artifact?: unknown;
}

export interface MessageCompletedEvent {
	type: 'message.completed';
	messageId: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface ErrorEvent {
	type: 'error';
	error: string;
}

/**
 * Type guard to check if an event is a specific type
 */
export function isServerEvent<T extends ServerEvent['type']>(
	event: unknown,
	type: T,
): event is Extract<ServerEvent, { type: T }> {
	return (
		typeof event === 'object' &&
		event !== null &&
		'type' in event &&
		event.type === type
	);
}
