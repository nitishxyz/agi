import type { Context } from 'hono';
import type { Hono } from 'hono';
import { subscribe } from '../events/bus.ts';
import type { OttoEvent } from '../events/types.ts';
import { openApiRoute } from '../openapi/route.ts';

function safeStringify(obj: unknown): string {
	return JSON.stringify(obj, (_key, value) =>
		typeof value === 'bigint' ? Number(value) : value,
	);
}

function handleSessionStream(c: Context) {
	const sessionId = c.req.param('id');
	const headers = new Headers({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		Connection: 'keep-alive',
	});

	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const write = (evt: OttoEvent) => {
				let line: string;
				try {
					line =
						`event: ${evt.type}\n` +
						`data: ${safeStringify(evt.payload ?? {})}\n\n`;
				} catch {
					line = `event: ${evt.type}\ndata: {}\n\n`;
				}
				controller.enqueue(encoder.encode(line));
			};
			const unsubscribe = subscribe(sessionId, write);
			controller.enqueue(encoder.encode(`: connected ${sessionId}\n\n`));
			const hb = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: hb ${Date.now()}\n\n`));
				} catch {
					clearInterval(hb);
				}
			}, 5000);

			const signal = c.req.raw?.signal as AbortSignal | undefined;
			signal?.addEventListener('abort', () => {
				clearInterval(hb);
				unsubscribe();
				try {
					controller.close();
				} catch {}
			});
		},
	});

	return new Response(stream, { headers });
}

export function registerSessionStreamRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{id}/stream',
			tags: ['stream'],
			operationId: 'subscribeSessionStream',
			summary: 'Subscribe to session event stream (SSE)',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'path',
					name: 'id',
					required: true,
					schema: {
						type: 'string',
					},
				},
			],
			responses: {
				'200': {
					description: 'text/event-stream',
					content: {
						'text/event-stream': {
							schema: {
								type: 'string',
								description:
									'SSE event stream. Events include session.created, message.created, message.part.delta, tool.call, tool.delta, tool.result, message.completed, error.',
							},
						},
					},
				},
			},
		},
		handleSessionStream,
	);
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions/{id}/stream',
			tags: ['stream'],
			operationId: 'subscribeSessionStreamPost',
			summary: 'Subscribe to session event stream (SSE) using POST',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: { type: 'string' },
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'path',
					name: 'id',
					required: true,
					schema: { type: 'string' },
				},
			],
			responses: {
				'200': {
					description: 'text/event-stream',
					content: {
						'text/event-stream': {
							schema: { type: 'string' },
						},
					},
				},
			},
		},
		handleSessionStream,
	);
}
