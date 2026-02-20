import { projectQueryParam } from '../helpers';

export const filesPaths = {
	'/v1/files': {
		get: {
			tags: ['files'],
			operationId: 'listFiles',
			summary: 'List project files',
			description:
				'Returns list of files in the project directory, excluding common build artifacts and dependencies',
			parameters: [
				projectQueryParam(),
				{
					in: 'query',
					name: 'maxDepth',
					required: false,
					schema: { type: 'integer', default: 10 },
					description: 'Maximum directory depth to traverse',
				},
				{
					in: 'query',
					name: 'limit',
					required: false,
					schema: { type: 'integer', default: 1000 },
					description: 'Maximum number of files to return',
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
									files: {
										type: 'array',
										items: { type: 'string' },
									},
									changedFiles: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												path: { type: 'string' },
												status: {
													type: 'string',
													enum: [
														'added',
														'modified',
														'deleted',
														'renamed',
														'untracked',
													],
												},
											},
											required: ['path', 'status'],
										},
										description:
											'List of files with uncommitted changes (from git status)',
									},
									truncated: { type: 'boolean' },
								},
								required: ['files', 'changedFiles', 'truncated'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/files/tree': {
		get: {
			tags: ['files'],
			operationId: 'getFileTree',
			summary: 'Get directory tree listing',
			parameters: [
				projectQueryParam(),
				{
					in: 'query',
					name: 'path',
					required: false,
					schema: { type: 'string', default: '.' },
					description: 'Directory path relative to project root',
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
									items: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: { type: 'string' },
												path: { type: 'string' },
												type: {
													type: 'string',
													enum: ['file', 'directory'],
												},
												gitignored: { type: 'boolean' },
											},
											required: ['name', 'path', 'type'],
										},
									},
									path: { type: 'string' },
								},
								required: ['items', 'path'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/files/read': {
		get: {
			tags: ['files'],
			operationId: 'readFile',
			summary: 'Read file content',
			parameters: [
				projectQueryParam(),
				{
					in: 'query',
					name: 'path',
					required: true,
					schema: { type: 'string' },
					description: 'File path relative to project root',
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
									content: { type: 'string' },
									path: { type: 'string' },
									extension: { type: 'string' },
									lineCount: { type: 'integer' },
								},
								required: ['content', 'path', 'extension', 'lineCount'],
							},
						},
					},
				},
				400: {
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
				},
			},
		},
	},
} as const;
