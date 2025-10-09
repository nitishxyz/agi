import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { generateText, resolveModel, type ProviderId } from '@agi-cli/sdk';
import { loadConfig } from '@agi-cli/sdk';

const execFileAsync = promisify(execFile);

// Validation schemas - make project optional with default
const gitStatusSchema = z.object({
	project: z.string().optional(),
});

const gitDiffSchema = z.object({
	project: z.string().optional(),
	file: z.string(),
	staged: z
		.string()
		.optional()
		.transform((val) => val === 'true'),
});

const gitStageSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

const gitUnstageSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

const gitCommitSchema = z.object({
	project: z.string().optional(),
	message: z.string().min(1),
});

const gitGenerateCommitMessageSchema = z.object({
	project: z.string().optional(),
});

const gitPushSchema = z.object({
	project: z.string().optional(),
});

// Types
export interface GitFile {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
}

interface GitRoot {
	gitRoot: string;
}

interface GitError {
	error: string;
	code?: string;
}

// Helper functions
async function validateAndGetGitRoot(
	requestedPath: string,
): Promise<GitRoot | GitError> {
	try {
		const { stdout: gitRoot } = await execFileAsync(
			'git',
			['rev-parse', '--show-toplevel'],
			{
				cwd: requestedPath,
			},
		);
		return { gitRoot: gitRoot.trim() };
	} catch {
		return {
			error: 'Not a git repository',
			code: 'NOT_A_GIT_REPO',
		};
	}
}

function parseGitStatus(statusOutput: string): {
	staged: GitFile[];
	unstaged: GitFile[];
	untracked: GitFile[];
} {
	const lines = statusOutput.trim().split('\n').filter(Boolean);
	const staged: GitFile[] = [];
	const unstaged: GitFile[] = [];
	const untracked: GitFile[] = [];

	for (const line of lines) {
		const x = line[0]; // staged status
		const y = line[1]; // unstaged status
		const path = line.slice(3).trim();

		// Check if file is staged (X is not space or ?)
		if (x !== ' ' && x !== '?') {
			staged.push({
				path,
				status: getStatusFromCode(x),
				staged: true,
			});
		}

		// Check if file is unstaged (Y is not space)
		if (y !== ' ' && y !== '?') {
			unstaged.push({
				path,
				status: getStatusFromCode(y),
				staged: false,
			});
		}

		// Check if file is untracked
		if (x === '?' && y === '?') {
			untracked.push({
				path,
				status: 'untracked',
				staged: false,
			});
		}
	}

	return { staged, unstaged, untracked };
}

function getStatusFromCode(code: string): GitFile['status'] {
	switch (code) {
		case 'M':
			return 'modified';
		case 'A':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		default:
			return 'modified';
	}
}

async function getAheadBehind(
	gitRoot: string,
): Promise<{ ahead: number; behind: number }> {
	try {
		const { stdout } = await execFileAsync(
			'git',
			['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
			{ cwd: gitRoot },
		);
		const [ahead, behind] = stdout.trim().split(/\s+/).map(Number);
		return { ahead: ahead || 0, behind: behind || 0 };
	} catch {
		return { ahead: 0, behind: 0 };
	}
}

async function getCurrentBranch(gitRoot: string): Promise<string> {
	try {
		const { stdout } = await execFileAsync(
			'git',
			['branch', '--show-current'],
			{
				cwd: gitRoot,
			},
		);
		return stdout.trim();
	} catch {
		return 'unknown';
	}
}

export function registerGitRoutes(app: Hono) {
	// GET /v1/git/status - Get git status
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

			// Get status
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v1'],
				{ cwd: gitRoot },
			);

			const { staged, unstaged, untracked } = parseGitStatus(statusOutput);

			// Get ahead/behind counts
			const { ahead, behind } = await getAheadBehind(gitRoot);

			// Get current branch
			const branch = await getCurrentBranch(gitRoot);

			// Calculate hasChanges
			const hasChanges = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;

			return c.json({
				status: 'ok',
				data: {
					branch,
					ahead,
					behind,
					staged,
					unstaged,
					untracked,
					hasChanges,
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

	// GET /v1/git/diff - Get file diff
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

			// Get diff
			const args = query.staged
				? ['diff', '--cached', query.file]
				: ['diff', query.file];
			const { stdout: diff } = await execFileAsync('git', args, {
				cwd: gitRoot,
			});

			return c.json({
				status: 'ok',
				data: {
					diff: diff || 'No changes',
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

	// POST /v1/git/stage - Stage files
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

			// Stage files
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

	// POST /v1/git/unstage - Unstage files
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

			// Unstage files
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

	// POST /v1/git/commit - Commit staged changes
	app.post('/v1/git/commit', async (c) => {
		try {
			const body = await c.req.json();
			const { message, project } = gitCommitSchema.parse(body);

			const requestedPath = project || process.cwd();

			const validation = await validateAndGetGitRoot(requestedPath);
			if ('error' in validation) {
				return c.json(
					{ status: 'error', error: validation.error, code: validation.code },
					400,
				);
			}

			const { gitRoot } = validation;

			// Commit changes
			const { stdout } = await execFileAsync('git', ['commit', '-m', message], {
				cwd: gitRoot,
			});

			return c.json({
				status: 'ok',
				data: {
					message: stdout.trim(),
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to commit',
				},
				500,
			);
		}
	});

	// POST /v1/git/generate-commit-message - Generate commit message from staged changes
	app.post('/v1/git/generate-commit-message', async (c) => {
		try {
			const body = await c.req.json();
			const { project } = gitGenerateCommitMessageSchema.parse(body);

			const requestedPath = project || process.cwd();

			const validation = await validateAndGetGitRoot(requestedPath);
			if ('error' in validation) {
				return c.json(
					{ status: 'error', error: validation.error, code: validation.code },
					400,
				);
			}

			const { gitRoot } = validation;

			// Get staged diff
			const { stdout: diff } = await execFileAsync(
				'git',
				['diff', '--cached'],
				{
					cwd: gitRoot,
				},
			);

			if (!diff.trim()) {
				return c.json(
					{
						status: 'error',
						error: 'No staged changes to generate message from',
					},
					400,
				);
			}

			// Get file list for context
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v1'],
				{ cwd: gitRoot },
			);
			const { staged } = parseGitStatus(statusOutput);
			const fileList = staged.map((f) => `${f.status}: ${f.path}`).join('\n');

			// Load config to get provider settings
			const config = await loadConfig();

			// Use a simple model for quick commit message generation
			const provider = config.defaults?.provider || 'anthropic';
			const model = await resolveModel(
				provider as ProviderId,
				config.defaults?.model,
				undefined,
			);

			// Generate commit message using AI
			const prompt = `Generate a concise, conventional commit message for these git changes.

Staged files:
${fileList}

Diff (first 2000 chars):
${diff.slice(0, 2000)}

Guidelines:
- Use conventional commits format (feat:, fix:, docs:, etc.)
- Keep the first line under 72 characters
- Be specific but concise
- Focus on what changed and why, not how
- Do not include any markdown formatting or code blocks
- Return ONLY the commit message text, nothing else

Commit message:`;

			const { text } = await generateText({
				provider: provider as ProviderId,
				model: model.id,
				systemPrompt:
					'You are a helpful assistant that generates git commit messages.',
				prompt,
				maxTokens: 200,
			});

			const message = text.trim();

			return c.json({
				status: 'ok',
				data: {
					message,
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error
							? error.message
							: 'Failed to generate commit message',
				},
				500,
			);
		}
	});

	// GET /v1/git/branch - Get branch info
	app.get('/v1/git/branch', async (c) => {
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

			// Get current branch
			const branch = await getCurrentBranch(gitRoot);

			// Get ahead/behind counts
			const { ahead, behind } = await getAheadBehind(gitRoot);

			// Get remote info
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
	});

	// POST /v1/git/push - Push commits to remote
	app.post('/v1/git/push', async (c) => {
		try {
			// Parse JSON body, defaulting to empty object if parsing fails
			let body = {};
			try {
				body = await c.req.json();
			} catch (jsonError) {
				// If JSON parsing fails (e.g., empty body), use empty object
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

			// Check if there's a remote configured
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

			// Get current branch and check for upstream
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
				// No upstream set
			}

			// Push to remote - with proper error handling
			try {
				let pushOutput: string;
				let pushError: string;

				if (hasUpstream) {
					// Push to existing upstream
					const result = await execFileAsync('git', ['push'], { cwd: gitRoot });
					pushOutput = result.stdout;
					pushError = result.stderr;
				} else {
					// Set upstream and push
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
				// Handle specific git push errors
				const error = pushErr as {
					message?: string;
					stderr?: string;
					code?: number;
				};
				const errorMessage = error.stderr || error.message || 'Failed to push';

				// Check for common error patterns
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

				// Generic push error
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
