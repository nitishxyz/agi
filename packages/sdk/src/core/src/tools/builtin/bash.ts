import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
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
			
			return new Promise((resolve, reject) => {
				const proc = exec(
					`bash -lc '${cmd.replace(/'/g, "'\\''")}'`,
					{
						cwd: absCwd,
						maxBuffer: 10 * 1024 * 1024,
					}
				);

				let stdout = '';
				let stderr = '';

				proc.stdout?.on('data', (chunk) => {
					stdout += chunk.toString();
				});

				proc.stderr?.on('data', (chunk) => {
					stderr += chunk.toString();
				});

				proc.on('close', (exitCode) => {
					if (exitCode !== 0 && !allowNonZeroExit) {
						const msg = (stderr || stdout || `Command failed: ${cmd}`).trim();
						reject(new Error(msg));
					} else {
						resolve({ exitCode: exitCode ?? 0, stdout, stderr });
					}
				});

				proc.on('error', (err) => {
					reject(err);
				});
			});
		},
	});
	return { name: 'bash', tool: bash };
}
