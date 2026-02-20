import { errorResponse, projectQueryParam } from '../helpers';

const sessionIdParam = {
	in: 'path',
	name: 'sessionId',
	required: true,
	schema: { type: 'string' },
} as const;

export const sessionExtrasPaths = {
	'/v1/sessions/{sessionId}': {
		patch: {
			tags: ['sessions'],
			operationId: 'updateSession',
			summary: 'Update session preferences',
			parameters: [sessionIdParam, projectQueryParam()],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								agent: { type: 'string' },
								provider: { type: 'string' },
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
			summary: 'Delete a session and all its messages',
			parameters: [sessionIdParam, projectQueryParam()],
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
	'/v1/sessions/{sessionId}/queue': {
		get: {
			tags: ['sessions'],
			operationId: 'getSessionQueue',
			summary: 'Get queue state for a session',
			parameters: [sessionIdParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									currentMessageId: {
										type: 'string',
										nullable: true,
									},
									queuedMessages: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												assistantMessageId: { type: 'string' },
												agent: { type: 'string' },
												provider: { type: 'string' },
												model: { type: 'string' },
											},
										},
									},
									isRunning: { type: 'boolean' },
								},
								required: ['currentMessageId', 'queuedMessages', 'isRunning'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/sessions/{sessionId}/queue/{messageId}': {
		delete: {
			tags: ['sessions'],
			operationId: 'removeFromQueue',
			summary: 'Remove a message from session queue',
			parameters: [
				sessionIdParam,
				{
					in: 'path',
					name: 'messageId',
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
									success: { type: 'boolean' },
									removed: { type: 'boolean' },
									wasQueued: { type: 'boolean' },
									wasRunning: { type: 'boolean' },
									wasStored: { type: 'boolean' },
								},
								required: ['success'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/sessions/{sessionId}/messages/{messageId}/retry': {
		post: {
			tags: ['sessions'],
			operationId: 'retryMessage',
			summary: 'Retry a failed assistant message',
			parameters: [
				sessionIdParam,
				{
					in: 'path',
					name: 'messageId',
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
									success: { type: 'boolean' },
									messageId: { type: 'string' },
								},
								required: ['success', 'messageId'],
							},
						},
					},
				},
				400: errorResponse(),
				404: errorResponse(),
			},
		},
	},
	'/v1/sessions/{sessionId}/share': {
		get: {
			tags: ['sessions'],
			operationId: 'getShareStatus',
			summary: 'Get share status for a session',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									shared: { type: 'boolean' },
									shareId: { type: 'string' },
									url: { type: 'string' },
									title: { type: 'string', nullable: true },
									createdAt: { type: 'integer' },
									lastSyncedAt: { type: 'integer' },
									lastSyncedMessageId: { type: 'string' },
									syncedMessages: { type: 'integer' },
									totalMessages: { type: 'integer' },
									pendingMessages: { type: 'integer' },
									isSynced: { type: 'boolean' },
								},
								required: ['shared'],
							},
						},
					},
				},
			},
		},
		post: {
			tags: ['sessions'],
			operationId: 'shareSession',
			summary: 'Share a session',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									shared: { type: 'boolean' },
									shareId: { type: 'string' },
									url: { type: 'string' },
									message: { type: 'string' },
								},
								required: ['shared'],
							},
						},
					},
				},
				400: errorResponse(),
				404: errorResponse(),
			},
		},
		put: {
			tags: ['sessions'],
			operationId: 'syncShare',
			summary: 'Sync shared session with new messages',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									synced: { type: 'boolean' },
									url: { type: 'string' },
									newMessages: { type: 'integer' },
									message: { type: 'string' },
								},
								required: ['synced'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
		delete: {
			tags: ['sessions'],
			operationId: 'deleteShare',
			summary: 'Delete a shared session',
			parameters: [sessionIdParam, projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									deleted: { type: 'boolean' },
									sessionId: { type: 'string' },
								},
								required: ['deleted', 'sessionId'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/shares': {
		get: {
			tags: ['sessions'],
			operationId: 'listShares',
			summary: 'List all shared sessions for a project',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									shares: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												sessionId: { type: 'string' },
												shareId: { type: 'string' },
												url: { type: 'string' },
												title: { type: 'string', nullable: true },
												createdAt: { type: 'integer' },
												lastSyncedAt: { type: 'integer' },
											},
											required: [
												'sessionId',
												'shareId',
												'url',
												'createdAt',
												'lastSyncedAt',
											],
										},
									},
								},
								required: ['shares'],
							},
						},
					},
				},
			},
		},
	},
} as const;
