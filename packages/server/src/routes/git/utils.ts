import { execFile } from 'node:child_process';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import type { GitFile, GitRoot, GitError } from './types.ts';

const execFileAsync = promisify(execFile);

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

export function inferLanguage(filePath: string): string {
	const extension = extname(filePath).toLowerCase().replace('.', '');
	if (!extension) {
		return 'plaintext';
	}
	return LANGUAGE_MAP[extension] ?? 'plaintext';
}

export function summarizeDiff(diff: string): {
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

export async function validateAndGetGitRoot(
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

export async function checkIfNewFile(
	gitRoot: string,
	file: string,
): Promise<boolean> {
	try {
		await execFileAsync('git', ['ls-files', '--error-unmatch', file], {
			cwd: gitRoot,
		});
		return false;
	} catch {
		return true;
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
			return 'modified';
		default:
			return 'modified';
	}
}

export function parseGitStatus(
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
		if (line.startsWith('1 ') || line.startsWith('2 ')) {
			const parts = line.split(' ');
			if (parts.length < 9) continue;

			const xy = parts[1];
			const x = xy[0];
			const y = xy[1];
			const path = parts.slice(8).join(' ');
			const absPath = join(gitRoot, path);

			if (x !== '.') {
				staged.push({
					path,
					absPath,
					status: getStatusFromCodeV2(x),
					staged: true,
					isNew: x === 'A',
				});
			}

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

export async function getAheadBehind(
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

export async function getCurrentBranch(gitRoot: string): Promise<string> {
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
