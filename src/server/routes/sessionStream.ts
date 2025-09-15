import type { Hono } from 'hono';

export function registerSessionStreamRoute(app: Hono) {
	app.get('/v1/sessions/:id/stream', async (c) => {
		return c.text('SSE not implemented yet', 501);
	});
}
