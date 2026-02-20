import { projectQueryParam } from '../helpers';

export const sessionFilesPaths = {
	'/v1/sessions/{sessionId}/files': {
		get: {
			tags: ['sessions'],
			operationId: 'getSessionFiles',
			summary: 'Get files modified in a session',
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
								properties: {
									files: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												path: { type: 'string' },
												operationCount: { type: 'integer' },
												firstModified: { type: 'integer' },
												lastModified: { type: 'integer' },
												operations: {
													type: 'array',
													items: {
														type: 'object',
														properties: {
															path: { type: 'string' },
															operation: {
																type: 'string',
																enum: ['write', 'patch', 'edit', 'create'],
															},
															timestamp: { type: 'integer' },
															toolCallId: { type: 'string' },
															toolName: { type: 'string' },
														},
														required: [
															'path',
															'operation',
															'timestamp',
															'toolCallId',
															'toolName',
														],
													},
												},
											},
											required: [
												'path',
												'operationCount',
												'firstModified',
												'lastModified',
												'operations',
											],
										},
									},
									totalFiles: { type: 'integer' },
									totalOperations: { type: 'integer' },
								},
								required: ['files', 'totalFiles', 'totalOperations'],
							},
						},
					},
				},
				404: {
					description: 'Session not found',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { error: { type: 'string' } },
								required: ['error'],
							},
						},
					},
				},
			},
		},
	},
} as const;
