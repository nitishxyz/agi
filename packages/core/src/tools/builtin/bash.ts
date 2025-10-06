import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'bun';
import DESCRIPTION from './bash.txt' with { type: 'text' };

function normalizePath(p: string) {
	const parts = p.replace(/\\/g, '/').split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') stack.pop();
		else stack.push(part);
	}
	return `/${stack.join('/')}`;
}

function resolveSafePath(projectRoot: string, p: string) {
	const root = normalizePath(projectRoot);
	const abs = normalizePath(`${root}/${p || '.'}`);
	if (!(abs === root || abs.startsWith(`${root}/`))) {
		throw new Error(`cwd escapes project root: ${p}`);
	}
	return abs;
}

export function buildBashTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const bash = tool({
		description: DESCRIPTION,
		inputSchema: z
			.object({
				cmd: z.string().describe('Shell command to run (bash -lc <cmd>)'),
				cwd: z
					.string()
					.default('.')
					.describe('Working directory relative to project root'),
				allowNonZeroExit: z
					.boolean()
					.optional()
					.default(false)
					.describe('If true, do not throw on non-zero exit'),
			})
			.strict(),
		async execute({
			cmd,
			cwd,
			allowNonZeroExit,
		}: {
			cmd: string;
			cwd?: string;
			allowNonZeroExit?: boolean;
		}) {
			const absCwd = resolveSafePath(projectRoot, cwd || '.');
			const proc = spawn({
				cmd: ['bash', '-lc', cmd],
				cwd: absCwd,
				stdout: 'pipe',
				stderr: 'pipe',
			});
			const exitCode = await proc.exited;
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			if (exitCode !== 0 && !allowNonZeroExit) {
				const msg = (stderr || stdout || `Command failed: ${cmd}`).trim();
				throw new Error(msg);
			}
			return { exitCode, stdout, stderr };
		},
	});
	return { name: 'bash', tool: bash };
}
