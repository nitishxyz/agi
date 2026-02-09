import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { spawn } from 'node:child_process';
import DESCRIPTION from './bash.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';
import { getAugmentedPath } from '../bin-manager.ts';

function normalizePath(p: string) {
	const normalized = p.replace(/\\/g, '/');
	const driveMatch = normalized.match(/^([A-Za-z]):\//);
	const drivePrefix = driveMatch ? `${driveMatch[1]}:` : '';
	const rest = driveMatch ? normalized.slice(2) : normalized;
	const parts = rest.split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') stack.pop();
		else stack.push(part);
	}
	if (drivePrefix) return `${drivePrefix}/${stack.join('/')}`;
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
		}): Promise<
			ToolResponse<{
				exitCode: number;
				stdout: string;
				stderr: string;
			}>
		> {
			const absCwd = resolveSafePath(projectRoot, cwd || '.');

			return new Promise((resolve) => {
				const proc = spawn(cmd, {
					cwd: absCwd,
					shell: true,
					stdio: ['ignore', 'pipe', 'pipe'],
					env: { ...process.env, PATH: getAugmentedPath() },
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
						resolve(
							createToolError(
								`Command timed out after ${timeout}ms: ${cmd}`,
								'timeout',
								{
									parameter: 'timeout',
									value: timeout,
									suggestion: 'Increase timeout or optimize the command',
								},
							),
						);
					} else if (exitCode !== 0 && !allowNonZeroExit) {
						const errorDetail = stderr.trim() || stdout.trim() || '';
						const errorMsg = `Command failed with exit code ${exitCode}${errorDetail ? `\n\n${errorDetail}` : ''}`;
						resolve(
							createToolError(errorMsg, 'execution', {
								exitCode,
								stdout,
								stderr,
								cmd,
								suggestion:
									'Check command syntax or use allowNonZeroExit: true',
							}),
						);
					} else {
						resolve({
							ok: true,
							exitCode: exitCode ?? 0,
							stdout,
							stderr,
						});
					}
				});

				proc.on('error', (err) => {
					if (timeoutId) clearTimeout(timeoutId);
					resolve(
						createToolError(
							`Command execution failed: ${err.message}`,
							'execution',
							{
								cmd,
								originalError: err.message,
							},
						),
					);
				});
			});
		},
	});
	return { name: 'bash', tool: bash };
}
