import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitRemoteAddSchema, gitRemoteRemoveSchema } from './schemas.ts';
import { validateAndGetGitRoot } from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerRemoteRoutes(app: Hono) {
	app.get('/v1/git/remotes', async (c) => {
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
	});

	app.post('/v1/git/remotes', async (c) => {
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
	});

	app.delete('/v1/git/remotes', async (c) => {
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
	});
}
