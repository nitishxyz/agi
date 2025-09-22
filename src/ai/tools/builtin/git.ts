import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import GIT_STATUS_DESCRIPTION from './git.status.txt' with { type: 'text' };
import GIT_DIFF_DESCRIPTION from './git.diff.txt' with { type: 'text' };
import GIT_COMMIT_DESCRIPTION from './git.commit.txt' with { type: 'text' };

export function buildGitTools(
	projectRoot: string,
): Array<{ name: string; tool: Tool }> {
	async function inRepo(): Promise<boolean> {
		const res = await $`git -C ${projectRoot} rev-parse --is-inside-work-tree`
			.quiet()
			.text()
			.catch(() => '');
		return res.trim() === 'true';
	}

	const git_status = tool({
		description: GIT_STATUS_DESCRIPTION,
		inputSchema: z.object({}).optional(),
		async execute() {
			if (!(await inRepo())) throw new Error('Not a git repository');
			const out = await $`git -C ${projectRoot} status --porcelain=v1`.text();
			const lines = out.split('\n').filter(Boolean);
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
			if (!(await inRepo())) throw new Error('Not a git repository');
			const args = all ? ['diff'] : ['diff', '--staged'];
			const out = await $`git -C ${projectRoot} ${args}`.text();
			const limited = out.split('\n').slice(0, 5000).join('\n');
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
			if (!(await inRepo())) throw new Error('Not a git repository');
			const args = ['commit', '-m', message];
			if (amend) args.push('--amend');
			if (signoff) args.push('--signoff');
			const res = await $`git -C ${projectRoot} ${args}`
				.quiet()
				.text()
				.catch(async (e) => {
					const txt = typeof e?.stderr === 'string' ? e.stderr : String(e);
					throw new Error(txt || 'git commit failed');
				});
			return { result: res.trim() };
		},
	});

	return [
		{ name: 'git_status', tool: git_status },
		{ name: 'git_diff', tool: git_diff },
		{ name: 'git_commit', tool: git_commit },
	];
}
