import {
	errorResponse,
	projectQueryParam,
	sessionIdParam,
	withoutParam,
} from '../helpers';

export const messagesPaths = {
	'/v1/sessions/{id}/messages': {
		get: {
			tags: ['messages'],
			operationId: 'listMessages',
			summary: 'List messages for a session',
			parameters: [projectQueryParam(), sessionIdParam(), withoutParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'array',
								items: {
									allOf: [
										{ $ref: '#/components/schemas/Message' },
										{
											type: 'object',
											properties: {
												parts: {
													type: 'array',
													items: {
														$ref: '#/components/schemas/MessagePart',
													},
												},
											},
											required: [],
										},
									],
								},
							},
						},
					},
				},
			},
		},
		post: {
			tags: ['messages'],
			operationId: 'createMessage',
			summary: 'Send a user message and enqueue assistant run',
			parameters: [projectQueryParam(), sessionIdParam()],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							required: ['content'],
							properties: {
								content: { type: 'string' },
								agent: {
									type: 'string',
									description: 'Agent name. Defaults to config if omitted.',
								},
								provider: { $ref: '#/components/schemas/Provider' },
								model: { type: 'string' },
								userContext: {
									type: 'string',
									description:
										'Optional user-provided context to include in the system prompt.',
								},
							},
						},
					},
				},
			},
			responses: {
				202: {
					description: 'Accepted',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { messageId: { type: 'string' } },
								required: ['messageId'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
} as const;
