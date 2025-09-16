export function getOpenAPISpec() {
	const spec = {
		openapi: '3.0.3',
		info: {
			title: 'AGI Server API',
			version: '0.1.0',
			description:
				'Server-side API for AGI sessions, messages, and streaming events. All AI work runs on the server. Streaming uses SSE.',
		},
		tags: [{ name: 'sessions' }, { name: 'messages' }, { name: 'stream' }],
		paths: {
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
			'/v1/sessions/{id}/stream': {
				get: {
					tags: ['stream'],
					operationId: 'subscribeSessionStream',
					summary: 'Subscribe to session event stream (SSE)',
					parameters: [projectQueryParam(), sessionIdParam()],
					responses: {
						200: {
							description: 'text/event-stream',
							content: {
								'text/event-stream': {
									schema: {
										type: 'string',
										description:
											'SSE event stream. Events include session.created, message.created, message.part.delta, tool.call, tool.delta, tool.result, message.completed, error.',
									},
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				Provider: { type: 'string', enum: ['openai', 'anthropic', 'google'] },
				Session: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						title: { type: 'string', nullable: true },
						agent: { type: 'string' },
						provider: { $ref: '#/components/schemas/Provider' },
						model: { type: 'string' },
						projectPath: { type: 'string' },
						createdAt: { type: 'integer', format: 'int64' },
						lastActiveAt: { type: 'integer', format: 'int64', nullable: true },
						totalInputTokens: { type: 'integer', nullable: true },
						totalOutputTokens: { type: 'integer', nullable: true },
						totalToolTimeMs: { type: 'integer', nullable: true },
						toolCounts: {
							type: 'object',
							additionalProperties: { type: 'integer' },
							nullable: true,
						},
					},
					required: [
						'id',
						'agent',
						'provider',
						'model',
						'projectPath',
						'createdAt',
					],
				},
				Message: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						sessionId: { type: 'string' },
						role: {
							type: 'string',
							enum: ['system', 'user', 'assistant', 'tool'],
						},
						status: { type: 'string', enum: ['pending', 'complete', 'error'] },
						agent: { type: 'string' },
						provider: { $ref: '#/components/schemas/Provider' },
						model: { type: 'string' },
						createdAt: { type: 'integer', format: 'int64' },
						completedAt: { type: 'integer', format: 'int64', nullable: true },
						latencyMs: { type: 'integer', nullable: true },
						promptTokens: { type: 'integer', nullable: true },
						completionTokens: { type: 'integer', nullable: true },
						totalTokens: { type: 'integer', nullable: true },
						error: { type: 'string', nullable: true },
					},
					required: [
						'id',
						'sessionId',
						'role',
						'status',
						'agent',
						'provider',
						'model',
						'createdAt',
					],
				},
				MessagePart: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						messageId: { type: 'string' },
						index: { type: 'integer', format: 'int64' },
						type: {
							type: 'string',
							enum: ['text', 'tool_call', 'tool_result', 'image', 'error'],
						},
						content: {
							type: 'string',
							description:
								'JSON-encoded content. For text: {"text": string}. For tool_call: {"name": string, "args": object}. For tool_result: {"name": string, "result"?: any, "artifact"?: Artifact}.',
						},
						agent: { type: 'string' },
						provider: { $ref: '#/components/schemas/Provider' },
						model: { type: 'string' },
						startedAt: { type: 'integer', format: 'int64', nullable: true },
						completedAt: { type: 'integer', format: 'int64', nullable: true },
						toolName: { type: 'string', nullable: true },
						toolCallId: { type: 'string', nullable: true },
						toolDurationMs: { type: 'integer', nullable: true },
					},
					required: [
						'id',
						'messageId',
						'index',
						'type',
						'content',
						'agent',
						'provider',
						'model',
					],
				},
				Artifact: {
					oneOf: [
						{ $ref: '#/components/schemas/FileDiffArtifact' },
						{ $ref: '#/components/schemas/FileArtifact' },
					],
				},
				FileDiffArtifact: {
					type: 'object',
					properties: {
						kind: { type: 'string', enum: ['file_diff'] },
						patchFormat: { type: 'string', enum: ['unified'] },
						patch: { type: 'string' },
						summary: {
							type: 'object',
							properties: {
								files: { type: 'integer' },
								additions: { type: 'integer' },
								deletions: { type: 'integer' },
							},
							additionalProperties: false,
						},
					},
					required: ['kind', 'patchFormat', 'patch'],
				},
				FileArtifact: {
					type: 'object',
					properties: {
						kind: { type: 'string', enum: ['file'] },
						path: { type: 'string' },
						mime: { type: 'string' },
						size: { type: 'integer' },
						sha256: { type: 'string' },
					},
					required: ['kind', 'path'],
				},
			},
		},
	} as const;
	return spec;
}

function projectQueryParam() {
	return {
		in: 'query',
		name: 'project',
		required: false,
		schema: { type: 'string' },
		description:
			'Project root override (defaults to current working directory).',
	} as const;
}

function sessionIdParam() {
	return {
		in: 'path',
		name: 'id',
		required: true,
		schema: { type: 'string' },
	} as const;
}

function withoutParam() {
	return {
		in: 'query',
		name: 'without',
		required: false,
		schema: { type: 'string', enum: ['parts'] },
		description:
			'Exclude parts from the response. By default, parts are included.',
	} as const;
}

function errorResponse() {
	return {
		description: 'Bad Request',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: { error: { type: 'string' } },
					required: ['error'],
				},
			},
		},
	} as const;
}
