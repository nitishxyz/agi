import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitStatusSchema } from './schemas.ts';
import {
	validateAndGetGitRoot,
	getAheadBehind,
	getCurrentBranch,
} from './utils.ts';
import { openApiRoute } from '../../openapi/route.ts';

const execFileAsync = promisify(execFile);

export function registerBranchRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/git/branch',
			tags: ['git'],
			operationId: 'getGitBranch',
			summary: 'Get git branch information',
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
										$ref: '#/components/schemas/GitBranch',
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
				const query = gitStatusSchema.parse({
					project: c.req.query('project'),
				});

				const requestedPath = query.project || process.cwd();

				const validation = await validateAndGetGitRoot(requestedPath);
				if ('error' in validation) {
					return c.json(
						{ status: 'error', error: validation.error, code: validation.code },
						400,
					);
				}

				const { gitRoot } = validation;

				const branch = await getCurrentBranch(gitRoot);

				const { ahead, behind } = await getAheadBehind(gitRoot);

				try {
					const { stdout: remotes } = await execFileAsync('git', ['remote'], {
						cwd: gitRoot,
					});
					const remoteList = remotes.trim().split('\n').filter(Boolean);

					return c.json({
						status: 'ok',
						data: {
							branch,
							ahead,
							behind,
							remotes: remoteList,
						},
					});
				} catch {
					return c.json({
						status: 'ok',
						data: {
							branch,
							ahead,
							behind,
							remotes: [],
						},
					});
				}
			} catch (error) {
				return c.json(
					{
						status: 'error',
						error:
							error instanceof Error
								? error.message
								: 'Failed to get branch info',
					},
					500,
				);
			}
		},
	);
}
