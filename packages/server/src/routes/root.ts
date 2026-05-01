import type { Hono } from 'hono';
import { getServerInfo } from '../state.ts';
import { openApiRoute } from '../openapi/route.ts';

export function registerRootRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/',
			tags: ['server'],
			operationId: 'getRoot',
			summary: 'Server health check',
			responses: {
				'200': {
					description: 'Server is running',
					content: {
						'text/plain': {
							schema: { type: 'string' },
						},
					},
				},
			},
		},
		(c) => c.text('otto server running'),
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/server/info',
			tags: ['server'],
			operationId: 'getServerInfo',
			summary: 'Get server runtime information',
			responses: {
				'200': {
					description: 'Server runtime metadata',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								additionalProperties: true,
							},
						},
					},
				},
			},
		},
		(c) => {
			return c.json({
				...getServerInfo(),
			});
		},
	);
}
