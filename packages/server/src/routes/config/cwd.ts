import type { Hono } from 'hono';
import { basename } from 'node:path';
import { logger } from '@ottocode/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';
import { openApiRoute } from '../../openapi/route.ts';

export function registerCwdRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/config/cwd',
			tags: ['config'],
			operationId: 'getCwd',
			summary: 'Get current working directory info',
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									cwd: {
										type: 'string',
									},
									dirName: {
										type: 'string',
									},
								},
								required: ['cwd', 'dirName'],
							},
						},
					},
				},
			},
		},
		(c) => {
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
		},
	);
}
