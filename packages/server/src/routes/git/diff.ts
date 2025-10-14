import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gitDiffSchema } from './schemas.ts';
import {
	validateAndGetGitRoot,
	checkIfNewFile,
	inferLanguage,
	summarizeDiff,
} from './utils.ts';

const execFileAsync = promisify(execFile);

export function registerDiffRoute(app: Hono) {
	app.get('/v1/git/diff', async (c) => {
		try {
			const query = gitDiffSchema.parse({
				project: c.req.query('project'),
				file: c.req.query('file'),
				staged: c.req.query('staged'),
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
			const absPath = join(gitRoot, query.file);

			const isNewFile = await checkIfNewFile(gitRoot, query.file);

			if (isNewFile) {
				try {
					const content = await readFile(absPath, 'utf-8');
					const lineCount = content.split('\n').length;
					const language = inferLanguage(query.file);

					return c.json({
						status: 'ok',
						data: {
							file: query.file,
							absPath,
							diff: '',
							content,
							isNewFile: true,
							isBinary: false,
							insertions: lineCount,
							deletions: 0,
							language,
							staged: !!query.staged,
						},
					});
				} catch (error) {
					return c.json(
						{
							status: 'error',
							error:
								error instanceof Error ? error.message : 'Failed to read file',
						},
						500,
					);
				}
			}

			const diffArgs = query.staged
				? ['diff', '--cached', '--', query.file]
				: ['diff', '--', query.file];
			const numstatArgs = query.staged
				? ['diff', '--cached', '--numstat', '--', query.file]
				: ['diff', '--numstat', '--', query.file];

			const [{ stdout: diffOutput }, { stdout: numstatOutput }] =
				await Promise.all([
					execFileAsync('git', diffArgs, { cwd: gitRoot }),
					execFileAsync('git', numstatArgs, { cwd: gitRoot }),
				]);

			let insertions = 0;
			let deletions = 0;
			let binary = false;

			const numstatLine = numstatOutput.trim().split('\n').find(Boolean);
			if (numstatLine) {
				const [rawInsertions, rawDeletions] = numstatLine.split('\t');
				if (rawInsertions === '-' || rawDeletions === '-') {
					binary = true;
				} else {
					insertions = Number.parseInt(rawInsertions, 10) || 0;
					deletions = Number.parseInt(rawDeletions, 10) || 0;
				}
			}

			const diffText = diffOutput ?? '';
			if (!binary) {
				const summary = summarizeDiff(diffText);
				binary = summary.binary;
				if (insertions === 0 && deletions === 0) {
					insertions = summary.insertions;
					deletions = summary.deletions;
				}
			}

			const language = inferLanguage(query.file);

			return c.json({
				status: 'ok',
				data: {
					file: query.file,
					absPath,
					diff: diffText,
					isNewFile: false,
					isBinary: binary,
					insertions,
					deletions,
					language,
					staged: !!query.staged,
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to get diff',
				},
				500,
			);
		}
	});
}
