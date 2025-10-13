import { errorResponse, projectQueryParam } from '../helpers';

export const sessionsPaths = {
	'/v1/sessions': {
		get: {
			tags: ['sessions'],
			operationId: 'listSessions',
			summary: 'List sessions',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'array',
								items: { $ref: '#/components/schemas/Session' },
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
