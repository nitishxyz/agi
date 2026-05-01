import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitRemoteAddSchema, gitRemoteRemoveSchema } from './schemas.ts';
import { validateAndGetGitRoot } from './utils.ts';
import { openApiRoute } from '../../openapi/route.ts';

const execFileAsync = promisify(execFile);

export function registerRemoteRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/git/remotes',
			tags: ['git'],
			operationId: 'getGitRemotes',
			summary: 'List git remotes',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
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
											remotes: {
												type: 'array',
												items: {
													type: 'object',
													properties: {
														name: {
															type: 'string',
														},
														url: {
															type: 'string',
														},
														type: {
															type: 'string',
														},
													},
													required: ['name', 'url', 'type'],
												},
											},
										},
										required: ['remotes'],
									},
								},
								required: ['status', 'data'],
							},
						},
					},
				},
				'400': {
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
				const project = c.req.query('project');
				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				const { stdout } = await execFileAsync('git', ['remote', '-v'], {
					cwd: gitRoot,
				});

				const remotes: { name: string; url: string; type: string }[] = [];
				const seen = new Set<string>();
				for (const line of stdout.trim().split('\n').filter(Boolean)) {
					const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
					if (match) {
						const key = `${match[1]}:${match[3]}`;
						if (!seen.has(key)) {
							seen.add(key);
							remotes.push({
								name: match[1],
								url: match[2],
								type: match[3],
							});
						}
					}
				}

				return c.json({ status: 'ok', data: { remotes } });
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error ? error.message : 'Failed to list remotes',
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
			path: '/v1/git/remotes',
			tags: ['git'],
			operationId: 'addGitRemote',
			summary: 'Add a git remote',
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
								name: {
									type: 'string',
								},
								url: {
									type: 'string',
								},
							},
							required: ['name', 'url'],
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
											name: {
												type: 'string',
											},
											url: {
												type: 'string',
											},
										},
										required: ['name', 'url'],
									},
								},
								required: ['status', 'data'],
							},
						},
					},
				},
				'400': {
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
				const body = await c.req.json().catch(() => ({}));
				const { project, name, url } = gitRemoteAddSchema.parse(body);
				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				await execFileAsync('git', ['remote', 'add', name, url], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: { name, url },
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to add remote';
				const status = message.includes('already exists') ? 400 : 500;
				return c.json({ status: 'error', error: message }, status);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/git/remotes',
			tags: ['git'],
			operationId: 'removeGitRemote',
			summary: 'Remove a git remote',
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
								name: {
									type: 'string',
								},
							},
							required: ['name'],
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
											removed: {
												type: 'string',
											},
										},
										required: ['removed'],
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
				const body = await c.req.json().catch(() => ({}));
				const { project, name } = gitRemoteRemoveSchema.parse(body);
				const requestedPath = project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				await execFileAsync('git', ['remote', 'remove', name], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: { removed: name },
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to remove remote';
				return c.json({ status: 'error', error: message }, 500);
			}
		},
	);
}
