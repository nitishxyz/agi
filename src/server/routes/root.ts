import type { Hono } from 'hono';

export function registerRootRoutes(app: Hono) {
	app.get('/', (c) => c.text('agi server running'));
}
