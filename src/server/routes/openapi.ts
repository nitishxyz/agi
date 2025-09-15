import type { Hono } from 'hono';

export function registerOpenApiRoute(app: Hono) {
	app.get('/openapi.json', (c) =>
		c.json({
			openapi: '3.1.1',
			info: { title: 'AGI Server', version: '0.1.0' },
			paths: {
				'/v1/sessions': { get: {}, post: {} },
				'/v1/sessions/{id}/messages': { get: {}, post: {} },
				'/v1/sessions/{id}/stream': { get: {} },
			},
		}),
	);
}
