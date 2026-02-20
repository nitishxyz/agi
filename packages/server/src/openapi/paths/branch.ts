import { errorResponse, projectQueryParam } from '../helpers';

const sessionIdParam = {
	in: 'path',
	name: 'sessionId',
	required: true,
	schema: { type: 'string' },
} as const;

export const branchPaths = {
	'/v1/sessions/{sessionId}/branch': {
		post: {
			tags: ['sessions'],
			operationId: 'createBranch',
			summary: 'Create a branch from a session message',
			parameters: [sessionIdParam, projectQueryParam()],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								fromMessageId: { type: 'string' },
								provider: { type: 'string' },
								model: { type: 'string' },
								agent: { type: 'string' },
								title: { type: 'string' },
							},
							required: ['fromMessageId'],
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
	'/v1/sessions/{sessionId}/branches': {
		get: {
			tags: ['sessions'],
			operationId: 'listBranches',
			summary: 'List branches of a session',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									branches: {
										type: 'array',
										items: { $ref: '#/components/schemas/Session' },
									},
								},
								required: ['branches'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/sessions/{sessionId}/parent': {
		get: {
			tags: ['sessions'],
			operationId: 'getParentSession',
			summary: 'Get parent session of a branch',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									parent: {
										nullable: true,
										allOf: [{ $ref: '#/components/schemas/Session' }],
									},
								},
								required: ['parent'],
							},
						},
					},
				},
			},
		},
	},
} as const;
