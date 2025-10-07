import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname } from 'node:path';
import { z } from 'zod';
import { generateText, resolveModel } from '@agi-cli/sdk';
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

// Types
export interface GitFile {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
	oldPath?: string;
}

export interface GitStatus {
	branch: string;
	ahead: number;
	behind: number;
	staged: GitFile[];
	unstaged: GitFile[];
	untracked: GitFile[];
	hasChanges: boolean;
}

// File extension to language mapping
const languageMap: Record<string, string> = {
	'.ts': 'typescript',
	'.tsx': 'typescript',
	'.js': 'javascript',
	'.jsx': 'javascript',
	'.py': 'python',
	'.java': 'java',
	'.c': 'c',
	'.cpp': 'cpp',
	'.go': 'go',
	'.rs': 'rust',
	'.rb': 'ruby',
	'.php': 'php',
	'.css': 'css',
	'.html': 'html',
	'.json': 'json',
	'.xml': 'xml',
	'.yaml': 'yaml',
	'.yml': 'yaml',
	'.md': 'markdown',
	'.sh': 'bash',
};

function detectLanguage(filePath: string): string {
	const ext = extname(filePath).toLowerCase();
	return languageMap[ext] || 'plaintext';
}

// Helper function to find git root directory
async function findGitRoot(startPath: string): Promise<string> {
	try {
		const { stdout } = await execFileAsync(
			'git',
			['rev-parse', '--show-toplevel'],
			{ cwd: startPath },
		);
		return stdout.trim();
	} catch (_error) {
		// If not in a git repository, return the original path
		return startPath;
	}
}

// Git status parsing
function parseGitStatus(porcelainOutput: string): {
	staged: GitFile[];
	unstaged: GitFile[];
	untracked: GitFile[];
} {
	const staged: GitFile[] = [];
	const unstaged: GitFile[] = [];
	const untracked: GitFile[] = [];

	const lines = porcelainOutput.split('\n').filter((line) => line.trim());

	for (const line of lines) {
		if (line.length < 4) continue;

		const stagedStatus = line[0];
		const unstagedStatus = line[1];
		const filePath = line.slice(3);

		// Parse staged files
		if (stagedStatus !== ' ' && stagedStatus !== '?') {
			let status: GitFile['status'] = 'modified';
			if (stagedStatus === 'A') status = 'added';
			else if (stagedStatus === 'D') status = 'deleted';
			else if (stagedStatus === 'R') status = 'renamed';
			else if (stagedStatus === 'M') status = 'modified';

			staged.push({
				path: filePath,
				status,
				staged: true,
			});
		}

		// Parse unstaged files
		// NOTE: A file can appear in both staged and unstaged if it has staged changes
		// and additional working directory changes
		if (unstagedStatus !== ' ' && unstagedStatus !== '?') {
			let status: GitFile['status'] = 'modified';
			if (unstagedStatus === 'M') status = 'modified';
			else if (unstagedStatus === 'D') status = 'deleted';

			unstaged.push({
				path: filePath,
				status,
				staged: false,
			});
		}

		// Parse untracked files
		if (stagedStatus === '?' && unstagedStatus === '?') {
			untracked.push({
				path: filePath,
				status: 'untracked',
				staged: false,
			});
		}
	}

	return { staged, unstaged, untracked };
}

async function parseNumstat(
	numstatOutput: string,
	files: GitFile[],
): Promise<void> {
	const lines = numstatOutput.split('\n').filter((line) => line.trim());

	for (const line of lines) {
		const parts = line.split('\t');
		if (parts.length < 3) continue;

		const insertions = Number.parseInt(parts[0], 10);
		const deletions = Number.parseInt(parts[1], 10);
		const filePath = parts[2];

		const file = files.find((f) => f.path === filePath);
		if (file) {
			file.insertions = Number.isNaN(insertions) ? 0 : insertions;
			file.deletions = Number.isNaN(deletions) ? 0 : deletions;
		}
	}
}

async function getCurrentBranch(cwd: string): Promise<string> {
	try {
		const { stdout } = await execFileAsync(
			'git',
			['branch', '--show-current'],
			{ cwd },
		);
		return stdout.trim() || 'HEAD';
	} catch {
		return 'HEAD';
	}
}

async function getAheadBehind(
	cwd: string,
): Promise<{ ahead: number; behind: number }> {
	try {
		const { stdout } = await execFileAsync(
			'git',
			['rev-list', '--left-right', '--count', 'HEAD...@{u}'],
			{ cwd },
		);
		const parts = stdout.trim().split('\t');
		return {
			ahead: Number.parseInt(parts[0], 10) || 0,
			behind: Number.parseInt(parts[1], 10) || 0,
		};
	} catch {
		return { ahead: 0, behind: 0 };
	}
}

// Route handlers
export function registerGitRoutes(app: Hono) {
	// GET /v1/git/status - Get current git status
	app.get('/v1/git/status', async (c) => {
		try {
			const query = gitStatusSchema.parse({
				project: c.req.query('project'),
			});

			const requestedPath = query.project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			// Get git status
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v1'],
				{ cwd: gitRoot },
			);

			const { staged, unstaged, untracked } = parseGitStatus(statusOutput);

			// Get stats for staged files
			if (staged.length > 0) {
				try {
					const { stdout: stagedNumstat } = await execFileAsync(
						'git',
						['diff', '--cached', '--numstat'],
						{ cwd: gitRoot },
					);
					await parseNumstat(stagedNumstat, staged);
				} catch {
					// Ignore numstat errors
				}
			}

			// Get stats for unstaged files
			if (unstaged.length > 0) {
				try {
					const { stdout: unstagedNumstat } = await execFileAsync(
						'git',
						['diff', '--numstat'],
						{ cwd: gitRoot },
					);
					await parseNumstat(unstagedNumstat, unstaged);
				} catch {
					// Ignore numstat errors
				}
			}

			// Get branch info
			const branch = await getCurrentBranch(gitRoot);
			const { ahead, behind } = await getAheadBehind(gitRoot);

			const status: GitStatus = {
				branch,
				ahead,
				behind,
				staged,
				unstaged,
				untracked,
				hasChanges:
					staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
			};

			return c.json({
				status: 'ok',
				data: status,
			});
		} catch (error) {
			console.error('Git status error:', error);
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error ? error.message : 'Failed to get git status',
				},
				500,
			);
		}
	});

	// GET /v1/git/diff - Get diff for a specific file
	app.get('/v1/git/diff', async (c) => {
		try {
			const query = gitDiffSchema.parse({
				project: c.req.query('project'),
				file: c.req.query('file'),
				staged: c.req.query('staged'),
			});

			const requestedPath = query.project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);
			const file = query.file;
			const staged = query.staged;

			// Check if file is untracked (new file)
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v1', file],
				{ cwd: gitRoot },
			);

			const isUntracked = statusOutput.trim().startsWith('??');

			let diffOutput = '';
			let insertions = 0;
			let deletions = 0;

			if (isUntracked) {
				// For untracked files, show the entire file content as additions
				try {
					const { readFile } = await import('node:fs/promises');
					const { join } = await import('node:path');
					const filePath = join(gitRoot, file);
					const content = await readFile(filePath, 'utf-8');
					const lines = content.split('\n');

					// Create a diff-like output showing all lines as additions
					diffOutput = `diff --git a/${file} b/${file}\n`;
					diffOutput += `new file mode 100644\n`;
					diffOutput += `--- /dev/null\n`;
					diffOutput += `+++ b/${file}\n`;
					diffOutput += `@@ -0,0 +1,${lines.length} @@\n`;
					diffOutput += lines.map((line) => `+${line}`).join('\n');

					insertions = lines.length;
					deletions = 0;
				} catch (err) {
					console.error('Error reading new file:', err);
					diffOutput = `Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`;
				}
			} else {
				// For tracked files, use git diff
				const args = ['diff'];
				if (staged) {
					args.push('--cached');
				}
				args.push('--', file);

				const { stdout: gitDiff } = await execFileAsync('git', args, {
					cwd: gitRoot,
				});
				diffOutput = gitDiff;

				// Get stats
				const numstatArgs = ['diff', '--numstat'];
				if (staged) {
					numstatArgs.push('--cached');
				}
				numstatArgs.push('--', file);

				try {
					const { stdout: numstatOutput } = await execFileAsync(
						'git',
						numstatArgs,
						{ cwd: gitRoot },
					);
					const parts = numstatOutput.trim().split('\t');
					if (parts.length >= 2) {
						insertions = Number.parseInt(parts[0], 10) || 0;
						deletions = Number.parseInt(parts[1], 10) || 0;
					}
				} catch {
					// Ignore numstat errors
				}
			}

			// Check if binary
			const isBinary = diffOutput.includes('Binary files');

			return c.json({
				status: 'ok',
				data: {
					file,
					diff: diffOutput,
					insertions,
					deletions,
					language: detectLanguage(file),
					binary: isBinary,
				},
			});
		} catch (error) {
			console.error('Git diff error:', error);
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error ? error.message : 'Failed to get git diff',
				},
				500,
			);
		}
	});

	// POST /v1/git/generate-commit-message - Generate AI commit message
	app.post('/v1/git/generate-commit-message', async (c) => {
		try {
			const body = await c.req.json();
			const { project } = gitGenerateCommitMessageSchema.parse(body);
			const requestedPath = project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			// Check if there are staged changes
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['diff', '--cached', '--name-only'],
				{ cwd: gitRoot },
			);

			if (!statusOutput.trim()) {
				return c.json(
					{
						status: 'error',
						error: 'No staged changes to generate commit message for',
					},
					400,
				);
			}

			// Get the full staged diff
			const { stdout: stagedDiff } = await execFileAsync(
				'git',
				['diff', '--cached'],
				{ cwd: gitRoot },
			);

			// Limit diff size to avoid token limits (keep first 8000 chars)
			const limitedDiff =
				stagedDiff.length > 8000
					? `${stagedDiff.slice(0, 8000)}\n\n... (diff truncated due to size)`
					: stagedDiff;

			// Generate commit message using AI
			const prompt = `Based on the following git diff of staged changes, generate a clear and concise commit message following these guidelines:

1. Use conventional commit format: <type>(<scope>): <subject>
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
3. Keep the subject line under 72 characters
4. Use imperative mood ("add" not "added" or "adds")
5. Don't end the subject line with a period
6. If there are multiple significant changes, focus on the most important one
7. Be specific about what changed

Git diff of staged changes:
\`\`\`diff
${limitedDiff}
\`\`\`

Generate only the commit message, nothing else.`;

			// Load config to get default provider/model
			const cfg = await loadConfig(gitRoot);

			// Resolve the model using SDK - this doesn't create any session
			const model = await resolveModel(
				cfg.defaults.provider,
				cfg.defaults.model,
			);

			// Generate text directly - no session involved
			const result = await generateText({
				model,
				prompt,
			});

			// Extract and clean up the message
			let message = result.text || '';

			// Clean up the message (remove markdown code blocks if present)
			if (typeof message === 'string') {
				message = message
					.replace(/^```(?:text|commit)?\n?/gm, '')
					.replace(/```$/gm, '')
					.trim();
			}

			return c.json({
				status: 'ok',
				data: {
					message,
				},
			});
		} catch (error) {
			console.error('Generate commit message error:', error);
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

	// POST /v1/git/stage - Stage files
	app.post('/v1/git/stage', async (c) => {
		try {
			const body = await c.req.json();
			const { project, files } = gitStageSchema.parse(body);

			const requestedPath = project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			// Stage files - git add handles paths relative to git root
			await execFileAsync('git', ['add', ...files], { cwd: gitRoot });

			return c.json({
				status: 'ok',
				data: {
					staged: files,
					failed: [],
				},
			});
		} catch (error) {
			console.error('Git stage error:', error);
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
			const { project, files } = gitUnstageSchema.parse(body);

			const requestedPath = project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			// Try modern git restore first, fallback to reset
			try {
				await execFileAsync('git', ['restore', '--staged', ...files], {
					cwd: gitRoot,
				});
			} catch {
				// Fallback to older git reset HEAD
				await execFileAsync('git', ['reset', 'HEAD', ...files], {
					cwd: gitRoot,
				});
			}

			return c.json({
				status: 'ok',
				data: {
					unstaged: files,
					failed: [],
				},
			});
		} catch (error) {
			console.error('Git unstage error:', error);
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
			const { project, message } = gitCommitSchema.parse(body);

			const requestedPath = project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			// Check if there are staged changes
			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['diff', '--cached', '--name-only'],
				{ cwd: gitRoot },
			);

			if (!statusOutput.trim()) {
				return c.json(
					{
						status: 'error',
						error: 'No staged changes to commit',
					},
					400,
				);
			}

			// Commit
			const { stdout: commitOutput } = await execFileAsync(
				'git',
				['commit', '-m', message],
				{ cwd: gitRoot },
			);

			// Parse commit output for hash
			const hashMatch = commitOutput.match(/[\w/]+ ([a-f0-9]+)\]/);
			const hash = hashMatch ? hashMatch[1] : '';

			// Get commit stats
			const { stdout: statOutput } = await execFileAsync(
				'git',
				['show', '--stat', '--format=', 'HEAD'],
				{ cwd: gitRoot },
			);

			const filesChangedMatch = statOutput.match(/(\d+) files? changed/);
			const insertionsMatch = statOutput.match(/(\d+) insertions?/);
			const deletionsMatch = statOutput.match(/(\d+) deletions?/);

			return c.json({
				status: 'ok',
				data: {
					hash,
					message: message.split('\n')[0],
					filesChanged: filesChangedMatch
						? Number.parseInt(filesChangedMatch[1], 10)
						: 0,
					insertions: insertionsMatch
						? Number.parseInt(insertionsMatch[1], 10)
						: 0,
					deletions: deletionsMatch
						? Number.parseInt(deletionsMatch[1], 10)
						: 0,
				},
			});
		} catch (error) {
			console.error('Git commit error:', error);
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to commit',
				},
				500,
			);
		}
	});

	// GET /v1/git/branch - Get branch information
	app.get('/v1/git/branch', async (c) => {
		try {
			const query = gitStatusSchema.parse({
				project: c.req.query('project'),
			});

			const requestedPath = query.project || process.cwd();
			const gitRoot = await findGitRoot(requestedPath);

			const branch = await getCurrentBranch(gitRoot);
			const { ahead, behind } = await getAheadBehind(gitRoot);

			// Get all branches
			let allBranches: string[] = [];
			try {
				const { stdout: branchesOutput } = await execFileAsync(
					'git',
					['branch', '--list'],
					{ cwd: gitRoot },
				);
				allBranches = branchesOutput
					.split('\n')
					.map((line) => line.replace(/^\*?\s*/, '').trim())
					.filter(Boolean);
			} catch {
				allBranches = [branch];
			}

			// Get upstream branch
			let upstream = '';
			try {
				const { stdout: upstreamOutput } = await execFileAsync(
					'git',
					['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
					{ cwd: gitRoot },
				);
				upstream = upstreamOutput.trim();
			} catch {
				// No upstream configured
			}

			return c.json({
				status: 'ok',
				data: {
					current: branch,
					upstream,
					ahead,
					behind,
					all: allBranches,
				},
			});
		} catch (error) {
			console.error('Git branch error:', error);
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
}
