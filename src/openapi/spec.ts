import { providerIds } from '@/providers/utils.ts';

export function getOpenAPISpec() {
	const spec = {
		openapi: '3.0.3',
		info: {
			title: 'AGI Server API',
			version: '0.1.0',
			description:
				'Server-side API for AGI sessions, messages, and streaming events. All AI work runs on the server. Streaming uses SSE.',
		},
		tags: [
			{ name: 'sessions' },
			{ name: 'messages' },
			{ name: 'stream' },
			{ name: 'ask' },
		],
		paths: {
			'/v1/ask': {
				post: {
					tags: ['ask'],
					operationId: 'ask',
					summary: 'Send a prompt using the ask service',
					description:
						'Streamlined endpoint used by the CLI to send prompts and receive assistant responses. Creates sessions as needed and reuses the last session when requested.',
					parameters: [projectQueryParam()],
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['prompt'],
									properties: {
										prompt: {
											type: 'string',
											description: 'User prompt to send to the assistant.',
										},
										agent: {
											type: 'string',
											description:
												'Optional agent name to use for this request.',
										},
										provider: {
											$ref: '#/components/schemas/Provider',
											description:
												'Optional provider override. When omitted the agent and config defaults apply.',
										},
										model: {
											type: 'string',
											description:
												'Optional model override for the selected provider.',
										},
										sessionId: {
											type: 'string',
											description: 'Send the prompt to a specific session.',
										},
										last: {
											type: 'boolean',
											description:
												'If true, reuse the most recent session for the project.',
										},
										jsonMode: {
											type: 'boolean',
											description:
												'Request structured JSON output when supported by the agent.',
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
									schema: { $ref: '#/components/schemas/AskResponse' },
								},
							},
						},
						400: errorResponse(),
					},
				},
			},
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
				Provider: {
					type: 'string',
					enum: providerIds,
				},
				AskResponse: {
					type: 'object',
					properties: {
						sessionId: { type: 'string' },
						header: { $ref: '#/components/schemas/AskResponseHeader' },
						provider: { $ref: '#/components/schemas/Provider' },
						model: { type: 'string' },
						agent: { type: 'string' },
						assistantMessageId: { type: 'string' },
						message: {
							$ref: '#/components/schemas/AskResponseMessage',
							nullable: true,
							description:
								'Present when the request created a new session or reused the last session for the project.',
						},
					},
					required: [
						'sessionId',
						'header',
						'provider',
						'model',
						'agent',
						'assistantMessageId',
					],
				},
				AskResponseHeader: {
					type: 'object',
					properties: {
						sessionId: { type: 'string' },
						agent: { type: 'string', nullable: true },
						provider: {
							$ref: '#/components/schemas/Provider',
							nullable: true,
						},
						model: { type: 'string', nullable: true },
					},
					required: ['sessionId'],
				},
				AskResponseMessage: {
					type: 'object',
					properties: {
						kind: { type: 'string', enum: ['created', 'last'] },
						sessionId: { type: 'string' },
					},
					required: ['kind', 'sessionId'],
				},
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
