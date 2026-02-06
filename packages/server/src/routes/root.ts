import type { Hono } from 'hono';
import { getServerInfo } from '../state.ts';

export function registerRootRoutes(app: Hono) {
	app.get('/', (c) => c.text('otto server running'));

	app.get('/v1/server/info', (c) => {
		return c.json({
			...getServerInfo(),
		});
	});
}
