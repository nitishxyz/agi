import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { extname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { generateText } from 'ai';
import type { ProviderId } from '@agi-cli/sdk';
import { loadConfig, getAuth } from '@agi-cli/sdk';
import { resolveModel } from '../runtime/provider.ts';
import { getProviderSpoofPrompt } from '../runtime/prompt.ts';

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

const LANGUAGE_MAP: Record<string, string> = {
	js: 'javascript',
	jsx: 'jsx',
	ts: 'typescript',
	tsx: 'tsx',
	py: 'python',
	rb: 'ruby',
	go: 'go',
	rs: 'rust',
	java: 'java',
	c: 'c',
	cpp: 'cpp',
	h: 'c',
	hpp: 'cpp',
	cs: 'csharp',
	php: 'php',
	sh: 'bash',
	bash: 'bash',
	zsh: 'bash',
	sql: 'sql',
	json: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	xml: 'xml',
	html: 'html',
	css: 'css',
	scss: 'scss',
	md: 'markdown',
	txt: 'plaintext',
	svelte: 'svelte',
};

function inferLanguage(filePath: string): string {
	const extension = extname(filePath).toLowerCase().replace('.', '');
	if (!extension) {
		return 'plaintext';
	}
	return LANGUAGE_MAP[extension] ?? 'plaintext';
}

function summarizeDiff(diff: string): {
	insertions: number;
	deletions: number;
	binary: boolean;
} {
	let insertions = 0;
	let deletions = 0;
	let binary = false;

	for (const line of diff.split('\n')) {
		if (line.startsWith('Binary files ') || line.includes('GIT binary patch')) {
			binary = true;
			break;
		}

		if (line.startsWith('+') && !line.startsWith('+++')) {
			insertions++;
		} else if (line.startsWith('-') && !line.startsWith('---')) {
			deletions++;
		}
	}

	return { insertions, deletions, binary };
}

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
	absPath: string; // NEW: Absolute filesystem path
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
	oldPath?: string; // For renamed files
	isNew: boolean; // NEW: True for untracked or newly added files
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

/**
 * Check if a file is new/untracked (not in git index)
 */
async function checkIfNewFile(gitRoot: string, file: string): Promise<boolean> {
	try {
		// Check if file exists in git index or committed
		await execFileAsync('git', ['ls-files', '--error-unmatch', file], {
			cwd: gitRoot,
		});
		return false; // File exists in git
	} catch {
		return true; // File is new/untracked
	}
}

function parseGitStatus(
	statusOutput: string,
	gitRoot: string,
): {
	staged: GitFile[];
	unstaged: GitFile[];
	untracked: GitFile[];
} {
	const lines = statusOutput.trim().split('\n').filter(Boolean);
	const staged: GitFile[] = [];
	const unstaged: GitFile[] = [];
	const untracked: GitFile[] = [];

	for (const line of lines) {
		// Porcelain v2 format has different line types
		if (line.startsWith('1 ') || line.startsWith('2 ')) {
			// Regular changed entry: "1 XY sub <mH> <mI> <mW> <hH> <hI> <path>"
			// XY is a 2-character field with staged (X) and unstaged (Y) status
			const parts = line.split(' ');
			if (parts.length < 9) continue;

			const xy = parts[1]; // e.g., ".M", "M.", "MM", "A.", etc.
			const x = xy[0]; // staged status
			const y = xy[1]; // unstaged status
			const path = parts.slice(8).join(' '); // Path can contain spaces
			const absPath = join(gitRoot, path);

			// Check if file is staged (X is not '.')
			if (x !== '.') {
				staged.push({
					path,
					absPath,
					status: getStatusFromCodeV2(x),
					staged: true,
					isNew: x === 'A',
				});
			}

			// Check if file is unstaged (Y is not '.')
			if (y !== '.') {
				unstaged.push({
					path,
					absPath,
					status: getStatusFromCodeV2(y),
					staged: false,
					isNew: false,
				});
			}
		} else if (line.startsWith('? ')) {
			// Untracked file: "? <path>"
			const path = line.slice(2);
			const absPath = join(gitRoot, path);
			untracked.push({
				path,
				absPath,
				status: 'untracked',
				staged: false,
				isNew: true,
			});
		}
	}

	return { staged, unstaged, untracked };
}

function _getStatusFromCode(code: string): GitFile['status'] {
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

function getStatusFromCodeV2(code: string): GitFile['status'] {
	switch (code) {
		case 'M':
			return 'modified';
		case 'A':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		case 'C':
			return 'modified'; // Copied - treat as modified
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
				['status', '--porcelain=v2'],
				{ cwd: gitRoot },
			);

			const { staged, unstaged, untracked } = parseGitStatus(
				statusOutput,
				gitRoot,
			);

			// Get ahead/behind counts
			const { ahead, behind } = await getAheadBehind(gitRoot);

			// Get current branch
			const branch = await getCurrentBranch(gitRoot);

			// Calculate hasChanges
			const hasChanges =
				staged.length > 0 || unstaged.length > 0 || untracked.length > 0;

			return c.json({
				status: 'ok',
				data: {
					branch,
					ahead,
					behind,
					gitRoot, // NEW: Expose git root path
					workingDir: requestedPath, // NEW: Current working directory
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
			const absPath = join(gitRoot, query.file);

			// Check if file is new/untracked
			const isNewFile = await checkIfNewFile(gitRoot, query.file);

			// For new files, read and return full content
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
							diff: '', // Empty diff for new files
							content, // NEW: Full file content
							isNewFile: true, // NEW: Flag indicating this is a new file
							isBinary: false,
							insertions: lineCount,
							deletions: 0,
							language,
							staged: !!query.staged, // NEW: Whether showing staged or unstaged
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

			// For existing files, get diff output and stats
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
					absPath, // NEW: Absolute path
					diff: diffText,
					isNewFile: false, // NEW: Not a new file
					isBinary: binary,
					insertions,
					deletions,
					language,
					staged: !!query.staged, // NEW: Whether showing staged or unstaged
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
				['status', '--porcelain=v2'],
				{ cwd: gitRoot },
			);
			const { staged } = parseGitStatus(statusOutput, gitRoot);
			const fileList = staged.map((f) => `${f.status}: ${f.path}`).join('\n');

			// Load config to get provider settings
			const config = await loadConfig();

			// Use the default provider and model for quick commit message generation
			const provider = (config.defaults?.provider || 'anthropic') as ProviderId;
			const modelId = config.defaults?.model || 'claude-3-5-sonnet-20241022';

			// Check if we need OAuth spoof prompt (same as runner)
			const auth = await getAuth(provider, config.projectRoot);
			const needsSpoof = auth?.type === 'oauth';
			const spoofPrompt = needsSpoof
				? getProviderSpoofPrompt(provider)
				: undefined;

			// Resolve model with proper authentication (3-level fallback: OAuth, API key, env var)
			const model = await resolveModel(provider, modelId, config);

			// Generate commit message using AI
			const userPrompt = `Generate a concise, conventional commit message for these git changes.

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

			// Use spoof prompt as system if OAuth, otherwise use normal system prompt
			const systemPrompt = spoofPrompt
				? spoofPrompt
				: 'You are a helpful assistant that generates git commit messages.';

			const { text } = await generateText({
				model,
				system: systemPrompt,
				prompt: userPrompt,
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
