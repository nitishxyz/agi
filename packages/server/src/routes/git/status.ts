import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gitStatusSchema } from './schemas.ts';
import {
	validateAndGetGitRoot,
	parseGitStatus,
	getAheadBehind,
	getCurrentBranch,
} from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerStatusRoute(app: Hono) {
	app.get('/v1/git/status', async (c) => {
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

			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v2'],
				{ cwd: gitRoot },
			);

			const { staged, unstaged, untracked, conflicted } = parseGitStatus(
				statusOutput,
				gitRoot,
			);

			const { ahead, behind } = await getAheadBehind(gitRoot);

			const branch = await getCurrentBranch(gitRoot);

			const hasChanges =
				staged.length > 0 ||
				unstaged.length > 0 ||
				untracked.length > 0 ||
				conflicted.length > 0;

			const hasConflicts = conflicted.length > 0;

			return c.json({
				status: 'ok',
				data: {
					branch,
					ahead,
					behind,
					gitRoot,
					workingDir: requestedPath,
					staged,
					unstaged,
					untracked,
					conflicted,
					hasChanges,
					hasConflicts,
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error ? error.message : 'Failed to get status',
				},
				500,
			);
		}
	});
}
