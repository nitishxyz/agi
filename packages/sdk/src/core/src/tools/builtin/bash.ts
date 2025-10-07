import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';
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
				cmd: z.string().describe('Shell command to run (bash -c <cmd>)'),
				cwd: z
					.string()
					.default('.')
					.describe('Working directory relative to project root'),
				allowNonZeroExit: z
					.boolean()
					.optional()
					.default(false)
					.describe('If true, do not throw on non-zero exit'),
				timeout: z
					.number()
					.optional()
					.default(300000)
					.describe('Timeout in milliseconds (default: 300000 = 5 minutes)'),
			})
			.strict(),
		async execute({
			cmd,
			cwd,
			allowNonZeroExit,
			timeout = 300000,
		}: {
			cmd: string;
			cwd?: string;
			allowNonZeroExit?: boolean;
			timeout?: number;
		}) {
			const absCwd = resolveSafePath(projectRoot, cwd || '.');

			return new Promise((resolve, reject) => {
				// Use spawn with shell: true for cross-platform compatibility
				const proc = spawn(cmd, {
					cwd: absCwd,
					shell: true,
					stdio: ['ignore', 'pipe', 'pipe'],
				});

				let stdout = '';
				let stderr = '';
				let didTimeout = false;
				let timeoutId: ReturnType<typeof setTimeout> | null = null;

				if (timeout > 0) {
					timeoutId = setTimeout(() => {
						didTimeout = true;
						proc.kill();
					}, timeout);
				}

				proc.stdout?.on('data', (chunk) => {
					stdout += chunk.toString();
				});

				proc.stderr?.on('data', (chunk) => {
					stderr += chunk.toString();
				});

				proc.on('close', (exitCode) => {
					if (timeoutId) clearTimeout(timeoutId);

					if (didTimeout) {
						reject(new Error(`Command timed out after ${timeout}ms: ${cmd}`));
					} else if (exitCode !== 0 && !allowNonZeroExit) {
						const errorMsg =
							stderr.trim() ||
							stdout.trim() ||
							`Command failed with exit code ${exitCode}`;
						const msg = `${errorMsg}\n\nCommand: ${cmd}\nExit code: ${exitCode}`;
						reject(new Error(msg));
					} else {
						resolve({ exitCode: exitCode ?? 0, stdout, stderr });
					}
				});

				proc.on('error', (err) => {
					if (timeoutId) clearTimeout(timeoutId);
					reject(
						new Error(
							`Command execution failed: ${err.message}\n\nCommand: ${cmd}`,
						),
					);
				});
			});
		},
	});
	return { name: 'bash', tool: bash };
}
