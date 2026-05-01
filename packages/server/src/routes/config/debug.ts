import type { Hono } from 'hono';
import { logger, readDebugConfig, writeDebugConfig } from '@ottocode/sdk';
import { serializeError } from '../../runtime/errors/api-error.ts';
import { openApiRoute } from '../../openapi/route.ts';

export function registerDebugConfigRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/config/debug',
			tags: ['config'],
			operationId: 'getDebugConfig',
			summary: 'Get debug configuration',
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									enabled: {
										type: 'boolean',
									},
									scopes: {
										type: 'array',
										items: {
											type: 'string',
										},
									},
									logPath: {
										type: 'string',
									},
									sessionsDir: {
										type: 'string',
									},
									debugDir: {
										type: 'string',
									},
								},
								required: [
									'enabled',
									'scopes',
									'logPath',
									'sessionsDir',
									'debugDir',
								],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const debug = await readDebugConfig();
				return c.json(debug);
			} catch (error) {
				logger.error('Failed to load debug config', error);
				const errorResponse = serializeError(error);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'patch',
			path: '/v1/config/debug',
			tags: ['config'],
			operationId: 'updateDebugConfig',
			summary: 'Update debug configuration',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								enabled: {
									type: 'boolean',
								},
								scopes: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: {
										type: 'boolean',
									},
									debug: {
										type: 'object',
										properties: {
											enabled: {
												type: 'boolean',
											},
											scopes: {
												type: 'array',
												items: {
													type: 'string',
												},
											},
											logPath: {
												type: 'string',
											},
											sessionsDir: {
												type: 'string',
											},
											debugDir: {
												type: 'string',
											},
										},
										required: [
											'enabled',
											'scopes',
											'logPath',
											'sessionsDir',
											'debugDir',
										],
									},
								},
								required: ['success', 'debug'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
		},
	);
}
