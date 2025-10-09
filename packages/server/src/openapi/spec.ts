import { providerIds } from '@agi-cli/sdk';

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
			{ name: 'config' },
			{ name: 'git' },
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
			'/v1/config': {
				get: {
					tags: ['config'],
					operationId: 'getConfig',
					summary: 'Get full configuration',
					description:
						'Returns agents, authorized providers, models, and defaults',
					parameters: [projectQueryParam()],
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: { $ref: '#/components/schemas/Config' },
								},
							},
						},
					},
				},
			},
			'/v1/config/cwd': {
				get: {
					tags: ['config'],
					operationId: 'getCwd',
					summary: 'Get current working directory info',
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											cwd: { type: 'string' },
											dirName: { type: 'string' },
										},
										required: ['cwd', 'dirName'],
									},
								},
							},
						},
					},
				},
			},
			'/v1/config/agents': {
				get: {
					tags: ['config'],
					operationId: 'getAgents',
					summary: 'Get available agents',
					parameters: [projectQueryParam()],
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											agents: {
												type: 'array',
												items: { type: 'string' },
											},
											default: { type: 'string' },
										},
										required: ['agents', 'default'],
									},
								},
							},
						},
					},
				},
			},
			'/v1/config/providers': {
				get: {
					tags: ['config'],
					operationId: 'getProviders',
					summary: 'Get available providers',
					description: 'Returns only providers that have been authorized',
					parameters: [projectQueryParam()],
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											providers: {
												type: 'array',
												items: { $ref: '#/components/schemas/Provider' },
											},
											default: { $ref: '#/components/schemas/Provider' },
										},
										required: ['providers', 'default'],
									},
								},
							},
						},
					},
				},
			},
			'/v1/config/providers/{provider}/models': {
				get: {
					tags: ['config'],
					operationId: 'getProviderModels',
					summary: 'Get available models for a provider',
					parameters: [
						projectQueryParam(),
						{
							in: 'path',
							name: 'provider',
							required: true,
							schema: { $ref: '#/components/schemas/Provider' },
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
											models: {
												type: 'array',
												items: { $ref: '#/components/schemas/Model' },
											},
											default: { type: 'string', nullable: true },
										},
										required: ['models'],
									},
								},
							},
						},
						403: {
							description: 'Provider not authorized',
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
						404: {
							description: 'Provider not found',
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
			'/v1/git/status': {
				get: {
					tags: ['git'],
					operationId: 'getGitStatus',
					summary: 'Get git status',
					description:
						'Returns current git status including staged, unstaged, and untracked files',
					parameters: [projectQueryParam()],
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											status: { type: 'string', enum: ['ok'] },
											data: { $ref: '#/components/schemas/GitStatus' },
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/diff': {
				get: {
					tags: ['git'],
					operationId: 'getGitDiff',
					summary: 'Get git diff for a file',
					parameters: [
						projectQueryParam(),
						{
							in: 'query',
							name: 'file',
							required: true,
							schema: { type: 'string' },
							description: 'File path to get diff for',
						},
						{
							in: 'query',
							name: 'staged',
							required: false,
							schema: { type: 'string', enum: ['true', 'false'] },
							description: 'Show staged diff (default: unstaged)',
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
											status: { type: 'string', enum: ['ok'] },
											data: { $ref: '#/components/schemas/GitDiff' },
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/branch': {
				get: {
					tags: ['git'],
					operationId: 'getGitBranch',
					summary: 'Get git branch information',
					parameters: [projectQueryParam()],
					responses: {
						200: {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											status: { type: 'string', enum: ['ok'] },
											data: { $ref: '#/components/schemas/GitBranch' },
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/stage': {
				post: {
					tags: ['git'],
					operationId: 'stageFiles',
					summary: 'Stage files',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										project: { type: 'string' },
										files: {
											type: 'array',
											items: { type: 'string' },
										},
									},
									required: ['files'],
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
											status: { type: 'string', enum: ['ok'] },
											data: {
												type: 'object',
												properties: {
													staged: {
														type: 'array',
														items: { type: 'string' },
													},
													failed: {
														type: 'array',
														items: { type: 'string' },
													},
												},
												required: ['staged', 'failed'],
											},
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/unstage': {
				post: {
					tags: ['git'],
					operationId: 'unstageFiles',
					summary: 'Unstage files',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										project: { type: 'string' },
										files: {
											type: 'array',
											items: { type: 'string' },
										},
									},
									required: ['files'],
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
											status: { type: 'string', enum: ['ok'] },
											data: {
												type: 'object',
												properties: {
													unstaged: {
														type: 'array',
														items: { type: 'string' },
													},
													failed: {
														type: 'array',
														items: { type: 'string' },
													},
												},
												required: ['unstaged', 'failed'],
											},
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/commit': {
				post: {
					tags: ['git'],
					operationId: 'commitChanges',
					summary: 'Commit staged changes',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										project: { type: 'string' },
										message: { type: 'string', minLength: 1 },
									},
									required: ['message'],
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
											status: { type: 'string', enum: ['ok'] },
											data: { $ref: '#/components/schemas/GitCommit' },
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/generate-commit-message': {
				post: {
					tags: ['git'],
					operationId: 'generateCommitMessage',
					summary: 'Generate AI-powered commit message',
					description:
						'Uses AI to generate a commit message based on staged changes',
					requestBody: {
						required: false,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										project: { type: 'string' },
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
									schema: {
										type: 'object',
										properties: {
											status: { type: 'string', enum: ['ok'] },
											data: {
												type: 'object',
												properties: {
													message: { type: 'string' },
												},
												required: ['message'],
											},
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
					},
				},
			},
			'/v1/git/push': {
				post: {
					tags: ['git'],
					operationId: 'pushCommits',
					summary: 'Push commits to remote',
					description:
						'Pushes local commits to the configured remote repository',
					requestBody: {
						required: false,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										project: { type: 'string' },
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
									schema: {
										type: 'object',
										properties: {
											status: { type: 'string', enum: ['ok'] },
											data: {
												type: 'object',
												properties: {
													output: { type: 'string' },
												},
												required: ['output'],
											},
										},
										required: ['status', 'data'],
									},
								},
							},
						},
						400: gitErrorResponse(),
						500: gitErrorResponse(),
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
				Config: {
					type: 'object',
					properties: {
						agents: {
							type: 'array',
							items: { type: 'string' },
						},
						providers: {
							type: 'array',
							items: { $ref: '#/components/schemas/Provider' },
						},
						defaults: {
							type: 'object',
							properties: {
								agent: { type: 'string' },
								provider: { $ref: '#/components/schemas/Provider' },
								model: { type: 'string' },
							},
							required: ['agent', 'provider', 'model'],
						},
					},
					required: ['agents', 'providers', 'defaults'],
				},
				Model: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						label: { type: 'string' },
						toolCall: { type: 'boolean' },
						reasoning: { type: 'boolean' },
					},
					required: ['id', 'label'],
				},
				GitStatus: {
					type: 'object',
					properties: {
						branch: { type: 'string' },
						ahead: { type: 'integer' },
						behind: { type: 'integer' },
						staged: {
							type: 'array',
							items: { $ref: '#/components/schemas/GitFile' },
						},
						unstaged: {
							type: 'array',
							items: { $ref: '#/components/schemas/GitFile' },
						},
						untracked: {
							type: 'array',
							items: { $ref: '#/components/schemas/GitFile' },
						},
						hasChanges: { type: 'boolean' },
					},
					required: [
						'branch',
						'ahead',
						'behind',
						'staged',
						'unstaged',
						'untracked',
						'hasChanges',
					],
				},
				GitFile: {
					type: 'object',
					properties: {
						path: { type: 'string' },
						status: {
							type: 'string',
							enum: ['modified', 'added', 'deleted', 'renamed', 'untracked'],
						},
						staged: { type: 'boolean' },
						insertions: { type: 'integer' },
						deletions: { type: 'integer' },
						oldPath: { type: 'string' },
					},
					required: ['path', 'status', 'staged'],
				},
				GitDiff: {
					type: 'object',
					properties: {
						file: { type: 'string' },
						diff: { type: 'string' },
						insertions: { type: 'integer' },
						deletions: { type: 'integer' },
						language: { type: 'string' },
						binary: { type: 'boolean' },
					},
					required: [
						'file',
						'diff',
						'insertions',
						'deletions',
						'language',
						'binary',
					],
				},
				GitBranch: {
					type: 'object',
					properties: {
						current: { type: 'string' },
						upstream: { type: 'string' },
						ahead: { type: 'integer' },
						behind: { type: 'integer' },
						all: {
							type: 'array',
							items: { type: 'string' },
						},
					},
					required: ['current', 'upstream', 'ahead', 'behind', 'all'],
				},
				GitCommit: {
					type: 'object',
					properties: {
						hash: { type: 'string' },
						message: { type: 'string' },
						filesChanged: { type: 'integer' },
						insertions: { type: 'integer' },
						deletions: { type: 'integer' },
					},
					required: [
						'hash',
						'message',
						'filesChanged',
						'insertions',
						'deletions',
					],
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

function gitErrorResponse() {
	return {
		description: 'Error',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						status: { type: 'string', enum: ['error'] },
						error: { type: 'string' },
						code: { type: 'string' },
					},
					required: ['status', 'error'],
				},
			},
		},
	} as const;
}
