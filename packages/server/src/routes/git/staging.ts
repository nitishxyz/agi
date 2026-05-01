import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
	gitStageSchema,
	gitUnstageSchema,
	gitRestoreSchema,
	gitDeleteSchema,
} from './schemas.ts';
import { validateAndGetGitRoot } from './utils.ts';
import { openApiRoute } from '../../openapi/route.ts';

const execFileAsync = promisify(execFile);

export function registerStagingRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/git/stage',
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
								project: {
									type: 'string',
								},
								files: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
							},
							required: ['files'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['ok'],
									},
									data: {
										type: 'object',
										properties: {
											staged: {
												type: 'array',
												items: {
													type: 'string',
												},
											},
											failed: {
												type: 'array',
												items: {
													type: 'string',
												},
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
				'500': {
					description: 'Error',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['error'],
									},
									error: {
										type: 'string',
									},
									code: {
										type: 'string',
									},
								},
								required: ['status', 'error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const body = await c.req.json();
				const { files, project } = gitStageSchema.parse(body);

				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				if (files.length === 0) {
					return c.json(
						{
							status: 'error',
							error: 'No files specified',
						},
						400,
					);
				}

				await execFileAsync('git', ['add', ...files], { cwd: gitRoot });

				return c.json({
					status: 'ok',
					data: {
						staged: files,
					},
				});
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error ? error.message : 'Failed to stage files',
					},
					500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/git/unstage',
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
								project: {
									type: 'string',
								},
								files: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
							},
							required: ['files'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['ok'],
									},
									data: {
										type: 'object',
										properties: {
											unstaged: {
												type: 'array',
												items: {
													type: 'string',
												},
											},
											failed: {
												type: 'array',
												items: {
													type: 'string',
												},
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
				'500': {
					description: 'Error',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['error'],
									},
									error: {
										type: 'string',
									},
									code: {
										type: 'string',
									},
								},
								required: ['status', 'error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const body = await c.req.json();
				const { files, project } = gitUnstageSchema.parse(body);

				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				if (files.length === 0) {
					return c.json(
						{
							status: 'error',
							error: 'No files specified',
						},
						400,
					);
				}

				await execFileAsync('git', ['reset', 'HEAD', '--', ...files], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: {
						unstaged: files,
					},
				});
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error
								? error.message
								: 'Failed to unstage files',
					},
					500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/git/restore',
			tags: ['git'],
			operationId: 'restoreFiles',
			summary: 'Restore files to HEAD',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								project: {
									type: 'string',
								},
								files: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
							},
							required: ['files'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['ok'],
									},
									data: {
										type: 'object',
										properties: {
											restored: {
												type: 'array',
												items: {
													type: 'string',
												},
											},
										},
										required: ['restored'],
									},
								},
								required: ['status', 'data'],
							},
						},
					},
				},
				'500': {
					description: 'Error',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['error'],
									},
									error: {
										type: 'string',
									},
									code: {
										type: 'string',
									},
								},
								required: ['status', 'error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const body = await c.req.json();
				const { files, project } = gitRestoreSchema.parse(body);

				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				if (files.length === 0) {
					return c.json(
						{
							status: 'error',
							error: 'No files specified',
						},
						400,
					);
				}

				await execFileAsync('git', ['restore', '--', ...files], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: {
						restored: files,
					},
				});
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error
								? error.message
								: 'Failed to restore files',
					},
					500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/git/delete',
			tags: ['git'],
			operationId: 'deleteFiles',
			summary: 'Delete untracked files',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								project: {
									type: 'string',
								},
								files: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
							},
							required: ['files'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['ok'],
									},
									data: {
										type: 'object',
										properties: {
											deleted: {
												type: 'array',
												items: {
													type: 'string',
												},
											},
										},
										required: ['deleted'],
									},
								},
								required: ['status', 'data'],
							},
						},
					},
				},
				'500': {
					description: 'Error',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									status: {
										type: 'string',
										enum: ['error'],
									},
									error: {
										type: 'string',
									},
									code: {
										type: 'string',
									},
								},
								required: ['status', 'error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const body = await c.req.json();
				const { files, project } = gitDeleteSchema.parse(body);

				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				if (files.length === 0) {
					return c.json(
						{
							status: 'error',
							error: 'No files specified',
						},
						400,
					);
				}

				await execFileAsync('git', ['clean', '-f', '--', ...files], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: {
						deleted: files,
					},
				});
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error ? error.message : 'Failed to delete files',
					},
					500,
				);
			}
		},
	);
}
