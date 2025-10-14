import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitStageSchema, gitUnstageSchema, gitRestoreSchema } from './schemas.ts';
import { validateAndGetGitRoot } from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerStagingRoutes(app: Hono) {
	app.post('/v1/git/stage', async (c) => {
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
	});

	app.post('/v1/git/unstage', async (c) => {
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
						error instanceof Error ? error.message : 'Failed to unstage files',
				},
				500,
			);
		}
	});

	app.post('/v1/git/restore', async (c) => {
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
						error instanceof Error ? error.message : 'Failed to restore files',
				},
				500,
			);
		}
	});
}
