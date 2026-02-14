import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitStatusSchema } from './schemas.ts';

const execFileAsync = promisify(execFile);

export function registerInitRoute(app: Hono) {
	app.post('/v1/git/init', async (c) => {
		try {
			const body = await c.req.json().catch(() => ({}));
			const { project } = gitStatusSchema.parse(body);
			const requestedPath = project || process.cwd();

			await execFileAsync('git', ['init'], { cwd: requestedPath });

			return c.json({
				status: 'ok',
				data: { initialized: true, path: requestedPath },
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error
							? error.message
							: 'Failed to initialize git repository',
				},
				500,
			);
		}
	});
}
