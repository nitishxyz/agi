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
} as const;
