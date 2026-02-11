import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitPullSchema } from './schemas.ts';
import { validateAndGetGitRoot } from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerPullRoute(app: Hono) {
	app.post('/v1/git/pull', async (c) => {
		try {
			let body = {};
			try {
				body = await c.req.json();
			} catch {
				body = {};
			}

			const { project } = gitPullSchema.parse(body);

			const requestedPath = project || process.cwd();

			const validation = await validateAndGetGitRoot(requestedPath);
			if ('error' in validation) {
				return c.json(
					{ status: 'error', error: validation.error, code: validation.code },
					400,
				);
			}

			const { gitRoot } = validation;

			try {
				const result = await execFileAsync('git', ['pull'], {
					cwd: gitRoot,
				});

				return c.json({
					status: 'ok',
					data: {
						output: result.stdout.trim() || result.stderr.trim(),
					},
				});
			} catch (pullErr: unknown) {
				const error = pullErr as {
					message?: string;
					stderr?: string;
				};
				const errorMessage = error.stderr || error.message || 'Failed to pull';

				if (
					errorMessage.includes('CONFLICT') ||
					errorMessage.includes('merge conflict')
				) {
					return c.json(
						{
							status: 'error',
							error: 'Merge conflicts detected. Resolve conflicts manually',
							details: errorMessage,
						},
						400,
					);
				}

				if (
					errorMessage.includes('Permission denied') ||
					errorMessage.includes('authentication')
				) {
					return c.json(
						{
							status: 'error',
							error: 'Authentication failed. Check your git credentials',
							details: errorMessage,
						},
						401,
					);
				}

				return c.json(
					{
						status: 'error',
						error: 'Failed to pull changes',
						details: errorMessage,
					},
					500,
				);
			}
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to pull',
				},
				500,
			);
		}
	});
}
