import type { Hono } from 'hono';
import { basename } from 'node:path';
import { logger } from '../../runtime/logger.ts';
import { serializeError } from '../../runtime/api-error.ts';

export function registerCwdRoute(app: Hono) {
	app.get('/v1/config/cwd', (c) => {
		try {
			const cwd = process.cwd();
			const dirName = basename(cwd);
			return c.json({
				cwd,
				dirName,
			});
		} catch (error) {
			logger.error('Failed to get current working directory', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
