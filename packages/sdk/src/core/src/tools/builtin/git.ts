import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import GIT_STATUS_DESCRIPTION from './git.status.txt' with { type: 'text' };
import GIT_DIFF_DESCRIPTION from './git.diff.txt' with { type: 'text' };
import GIT_COMMIT_DESCRIPTION from './git.commit.txt' with { type: 'text' };

const execAsync = promisify(exec);

export function buildGitTools(
	projectRoot: string,
): Array<{ name: string; tool: Tool }> {
	// Helper to find git root directory
	async function findGitRoot(): Promise<string> {
		try {
			const { stdout } = await execAsync(
				`git -C "${projectRoot}" rev-parse --show-toplevel`,
			);
			return stdout.trim() || projectRoot;
		} catch {
			return projectRoot;
		}
	}

	async function inRepo(): Promise<boolean> {
		try {
			const { stdout } = await execAsync(
				`git -C "${projectRoot}" rev-parse --is-inside-work-tree`,
			);
			return stdout.trim() === 'true';
		} catch {
			return false;
		}
	}

	const git_status = tool({
		description: GIT_STATUS_DESCRIPTION,
		inputSchema: z.object({}).optional(),
		async execute() {
			if (!(await inRepo())) {
				return {
					error: 'Not a git repository',
					staged: 0,
					unstaged: 0,
					raw: [],
				};
			}
			const gitRoot = await findGitRoot();
			const { stdout } = await execAsync(
				`git -C "${gitRoot}" status --porcelain=v1`,
			);
			const lines = stdout.split('\n').filter(Boolean);
			let staged = 0;
			let unstaged = 0;
			for (const line of lines) {
				const x = line[0];
				const y = line[1];
				if (!x || !y) continue;
				if (x === '!' && y === '!') continue; // ignored files
				const isUntracked = x === '?' && y === '?';
				if (x !== ' ' && !isUntracked) staged += 1;
				if (isUntracked || y !== ' ') unstaged += 1;
			}
			return {
				staged,
				unstaged,
				raw: lines.slice(0, 200),
			};
		},
	});

	const git_diff = tool({
		description: GIT_DIFF_DESCRIPTION,
		inputSchema: z.object({ all: z.boolean().optional().default(false) }),
		async execute({ all }: { all?: boolean }) {
			if (!(await inRepo())) {
				return { error: 'Not a git repository', all: !!all, patch: '' };
			}
			const gitRoot = await findGitRoot();
			// When all=true, show full working tree diff relative to HEAD
			// so both staged and unstaged changes are included. Otherwise,
			// show only the staged diff (index vs HEAD).
			const cmd = all
				? `git -C "${gitRoot}" diff HEAD`
				: `git -C "${gitRoot}" diff --staged`;
			const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
			const limited = stdout.split('\n').slice(0, 5000).join('\n');
			return { all: !!all, patch: limited };
		},
	});

	const git_commit = tool({
		description: GIT_COMMIT_DESCRIPTION,
		inputSchema: z.object({
			message: z.string().min(5),
			amend: z.boolean().optional().default(false),
			signoff: z.boolean().optional().default(false),
		}),
		async execute({
			message,
			amend,
			signoff,
		}: {
			message: string;
			amend?: boolean;
			signoff?: boolean;
		}) {
			if (!(await inRepo())) {
				return { success: false, error: 'Not a git repository' };
			}
			const gitRoot = await findGitRoot();
			const args = [
				'git',
				'-C',
				`"${gitRoot}"`,
				'commit',
				'-m',
				`"${message.replace(/"/g, '\\"')}"`,
			];
			if (amend) args.push('--amend');
			if (signoff) args.push('--signoff');
			try {
				const { stdout } = await execAsync(args.join(' '));
				return { result: stdout.trim() };
			} catch (error: unknown) {
				const err = error as { stderr?: string; message?: string };
				const txt = err.stderr || err.message || 'git commit failed';
				throw new Error(txt);
			}
		},
	});

	return [
		{ name: 'git_status', tool: git_status },
		{ name: 'git_diff', tool: git_diff },
		{ name: 'git_commit', tool: git_commit },
	];
}
