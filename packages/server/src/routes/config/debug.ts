import type { Hono } from 'hono';
import { logger, readDebugConfig, writeDebugConfig } from '@ottocode/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';

export function registerDebugConfigRoute(app: Hono) {
	app.get('/v1/config/debug', async (c) => {
		try {
			const debug = await readDebugConfig();
			return c.json(debug);
		} catch (error) {
			logger.error('Failed to load debug config', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.patch('/v1/config/debug', async (c) => {
		try {
			const body = await c.req.json<{
				enabled?: boolean;
				scopes?: string[];
			}>();

			await writeDebugConfig({
				enabled: body.enabled,
				scopes: Array.isArray(body.scopes)
					? body.scopes.map((scope) => scope.trim()).filter(Boolean)
					: body.scopes,
			});

			const debug = await readDebugConfig();
			return c.json({ success: true, debug });
		} catch (error) {
			logger.error('Failed to update debug config', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
