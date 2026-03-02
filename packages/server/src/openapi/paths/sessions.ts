import { errorResponse, projectQueryParam } from '../helpers';

export const sessionsPaths = {
	'/v1/sessions': {
		get: {
			tags: ['sessions'],
			operationId: 'listSessions',
			summary: 'List sessions',
			parameters: [
				projectQueryParam(),
				{
					in: 'query',
					name: 'limit',
					schema: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
					description: 'Maximum number of sessions to return',
				},
				{
					in: 'query',
					name: 'offset',
					schema: { type: 'integer', default: 0, minimum: 0 },
					description: 'Offset for pagination',
				},
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									items: {
										type: 'array',
										items: { $ref: '#/components/schemas/Session' },
									},
									hasMore: { type: 'boolean' },
									nextOffset: { type: 'integer', nullable: true },
								},
								required: ['items', 'hasMore', 'nextOffset'],
							},
						},
					},
				},
			},
		},
		post: {
			tags: ['sessions'],
			operationId: 'createSession',
			summary: 'Create a new session',
			parameters: [projectQueryParam()],
			requestBody: {
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								title: { type: 'string', nullable: true },
								agent: { type: 'string' },
								provider: { $ref: '#/components/schemas/Provider' },
								model: { type: 'string' },
							},
						},
					},
				},
			},
			responses: {
				201: {
					description: 'Created',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Session' },
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/sessions/{sessionId}': {
		get: {
			tags: ['sessions'],
			operationId: 'getSession',
			summary: 'Get a single session by ID',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Session' },
						},
					},
				},
				404: errorResponse(),
			},
		},
		patch: {
			tags: ['sessions'],
			operationId: 'updateSession',
			summary: 'Update session preferences',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								title: { type: 'string' },
								agent: { type: 'string' },
								provider: { $ref: '#/components/schemas/Provider' },
								model: { type: 'string' },
							},
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Session' },
						},
					},
				},
				400: errorResponse(),
				404: errorResponse(),
			},
		},
		delete: {
			tags: ['sessions'],
			operationId: 'deleteSession',
			summary: 'Delete a session',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { success: { type: 'boolean' } },
								required: ['success'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/sessions/{sessionId}/abort': {
		delete: {
			tags: ['sessions'],
			operationId: 'abortSession',
			summary: 'Abort a running session',
			description:
				'Aborts any currently running assistant generation for the session',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: { type: 'string' },
					description: 'Session ID to abort',
				},
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { success: { type: 'boolean' } },
								required: ['success'],
							},
						},
					},
				},
			},
		},
	},
} as const;
