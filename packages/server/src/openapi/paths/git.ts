import { gitErrorResponse, projectQueryParam } from '../helpers';

export const gitPaths = {
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
			description: 'Pushes local commits to the configured remote repository',
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
} as const;
