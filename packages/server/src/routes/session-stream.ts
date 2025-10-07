import type { Hono } from 'hono';
import { subscribe } from '../events/bus.ts';
import type { AGIEvent } from '../events/types.ts';

export function registerSessionStreamRoute(app: Hono) {
	app.get('/v1/sessions/:id/stream', async (c) => {
		const sessionId = c.req.param('id');
		const headers = new Headers({
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		});

		const encoder = new TextEncoder();

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const write = (evt: AGIEvent) => {
					const line =
						`event: ${evt.type}\n` +
						`data: ${JSON.stringify(evt.payload ?? {})}\n\n`;
					controller.enqueue(encoder.encode(line));
				};
				const unsubscribe = subscribe(sessionId, write);
				// Initial ping
				controller.enqueue(encoder.encode(`: connected ${sessionId}\n\n`));
				// Heartbeat every 5s to prevent idle timeout (Bun default is 10s)
				const hb = setInterval(() => {
					try {
						controller.enqueue(encoder.encode(`: hb ${Date.now()}\n\n`));
					} catch {
						// Controller might be closed
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
	});
}
