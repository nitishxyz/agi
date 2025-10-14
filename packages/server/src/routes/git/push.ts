import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitPushSchema } from './schemas.ts';
import { validateAndGetGitRoot, getCurrentBranch } from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerPushRoute(app: Hono) {
	app.post('/v1/git/push', async (c) => {
		try {
			let body = {};
			try {
				body = await c.req.json();
			} catch (jsonError) {
				console.warn(
					'Failed to parse JSON body for git push, using empty object:',
					jsonError,
				);
			}

			const { project } = gitPushSchema.parse(body);

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
				const { stdout: remotes } = await execFileAsync('git', ['remote'], {
					cwd: gitRoot,
				});
				if (!remotes.trim()) {
					return c.json(
						{ status: 'error', error: 'No remote repository configured' },
						400,
					);
				}
			} catch {
				return c.json(
					{ status: 'error', error: 'No remote repository configured' },
					400,
				);
			}

			const branch = await getCurrentBranch(gitRoot);
			let hasUpstream = false;
			try {
				await execFileAsync(
					'git',
					['rev-parse', '--abbrev-ref', '@{upstream}'],
					{
						cwd: gitRoot,
					},
				);
				hasUpstream = true;
			} catch {
			}

			try {
				let pushOutput: string;
				let pushError: string;

				if (hasUpstream) {
					const result = await execFileAsync('git', ['push'], { cwd: gitRoot });
					pushOutput = result.stdout;
					pushError = result.stderr;
				} else {
					const result = await execFileAsync(
						'git',
						['push', '--set-upstream', 'origin', branch],
						{ cwd: gitRoot },
					);
					pushOutput = result.stdout;
					pushError = result.stderr;
				}

				return c.json({
					status: 'ok',
					data: {
						output: pushOutput.trim() || pushError.trim(),
					},
				});
			} catch (pushErr: unknown) {
				const error = pushErr as {
					message?: string;
					stderr?: string;
					code?: number;
				};
				const errorMessage = error.stderr || error.message || 'Failed to push';

				if (
					errorMessage.includes('failed to push') ||
					errorMessage.includes('rejected')
				) {
					return c.json(
						{
							status: 'error',
							error: 'Push rejected. Try pulling changes first with: git pull',
							details: errorMessage,
						},
						400,
					);
				}

				if (
					errorMessage.includes('Permission denied') ||
					errorMessage.includes('authentication') ||
					errorMessage.includes('could not read')
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

				if (
					errorMessage.includes('Could not resolve host') ||
					errorMessage.includes('network')
				) {
					return c.json(
						{
							status: 'error',
							error: 'Network error. Check your internet connection',
							details: errorMessage,
						},
						503,
					);
				}

				return c.json(
					{
						status: 'error',
						error: 'Failed to push commits',
						details: errorMessage,
					},
					500,
				);
			}
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to push',
				},
				500,
			);
		}
	});
}
