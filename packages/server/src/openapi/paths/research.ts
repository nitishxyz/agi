import { errorResponse, projectQueryParam } from '../helpers';

export const researchPaths = {
	'/v1/sessions/{parentId}/research': {
		get: {
			tags: ['sessions'],
			operationId: 'listResearchSessions',
			summary: 'List research sessions for a parent',
			parameters: [
				{
					in: 'path',
					name: 'parentId',
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
								properties: {
									sessions: {
										type: 'array',
										items: { $ref: '#/components/schemas/Session' },
									},
								},
								required: ['sessions'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
		post: {
			tags: ['sessions'],
			operationId: 'createResearchSession',
			summary: 'Create a research session',
			parameters: [
				{
					in: 'path',
					name: 'parentId',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			requestBody: {
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								provider: { type: 'string' },
								model: { type: 'string' },
								title: { type: 'string' },
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
							schema: {
								type: 'object',
								properties: {
									session: { $ref: '#/components/schemas/Session' },
									parentSessionId: { type: 'string' },
								},
								required: ['session', 'parentSessionId'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/research/{researchId}': {
		delete: {
			tags: ['sessions'],
			operationId: 'deleteResearchSession',
			summary: 'Delete a research session',
			parameters: [
				{
					in: 'path',
					name: 'researchId',
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
				400: errorResponse(),
				404: errorResponse(),
			},
		},
	},
	'/v1/sessions/{parentId}/inject': {
		post: {
			tags: ['sessions'],
			operationId: 'injectResearchContext',
			summary: 'Inject research context into parent session',
			parameters: [
				{
					in: 'path',
					name: 'parentId',
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
								researchSessionId: { type: 'string' },
								label: { type: 'string' },
							},
							required: ['researchSessionId'],
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									content: { type: 'string' },
									label: { type: 'string' },
									sessionId: { type: 'string' },
									parentSessionId: { type: 'string' },
									tokenEstimate: { type: 'integer' },
								},
								required: [
									'content',
									'label',
									'sessionId',
									'parentSessionId',
									'tokenEstimate',
								],
							},
						},
					},
				},
				400: errorResponse(),
				404: errorResponse(),
			},
		},
	},
	'/v1/research/{researchId}/export': {
		post: {
			tags: ['sessions'],
			operationId: 'exportResearchSession',
			summary: 'Export research session to a new main session',
			parameters: [
				{
					in: 'path',
					name: 'researchId',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			requestBody: {
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								provider: { type: 'string' },
								model: { type: 'string' },
								agent: { type: 'string' },
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
							schema: {
								type: 'object',
								properties: {
									newSession: { $ref: '#/components/schemas/Session' },
									injectedContext: { type: 'string' },
								},
								required: ['newSession', 'injectedContext'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
} as const;
