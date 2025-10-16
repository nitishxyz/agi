import { tool, type Tool } from 'ai';
import { z } from 'zod';
import DESCRIPTION from './terminal.txt' with { type: 'text' };
import { createToolError } from '../error.ts';
import type { TerminalManager } from '../../terminals/index.ts';

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

export function buildTerminalTool(
	projectRoot: string,
	terminalManager: TerminalManager,
): {
	name: string;
	tool: Tool;
} {
	const terminal = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			operation: z
				.enum(['start', 'read', 'write', 'list', 'kill'])
				.describe('Operation to perform'),

			command: z.string().optional().describe('For start: Command to run'),
			args: z
				.array(z.string())
				.optional()
				.describe('For start: Command arguments'),
			purpose: z
				.string()
				.optional()
				.describe('For start: Description of what this terminal is for'),
			cwd: z
				.string()
				.default('.')
				.describe('For start: Working directory relative to project root'),

			terminalId: z
				.string()
				.optional()
				.describe('For read/write/kill: Terminal ID'),

			lines: z
				.number()
				.default(100)
				.optional()
				.describe('For read: Number of lines to read from end'),

			input: z
				.string()
				.optional()
				.describe('For write: String to write to stdin'),
		}),
		execute: async (params) => {
			try {
				const { operation } = params;

				switch (operation) {
					case 'start': {
						if (!params.command) {
							return createToolError('command is required for start operation');
						}
						if (!params.purpose) {
							return createToolError('purpose is required for start operation');
						}

						const cwd = resolveSafePath(projectRoot, params.cwd);

						const term = terminalManager.create({
							command: params.command,
							args: params.args,
							cwd,
							purpose: params.purpose,
							createdBy: 'llm',
						});

						return {
							ok: true,
							terminalId: term.id,
							pid: term.pid,
							purpose: term.purpose,
							command: params.command,
							args: params.args || [],
							message: `Started: ${params.command}${params.args ? ` ${params.args.join(' ')}` : ''}`,
						};
					}

					case 'read': {
						if (!params.terminalId) {
							return createToolError(
								'terminalId is required for read operation',
							);
						}

						const term = terminalManager.get(params.terminalId);
						if (!term) {
							return createToolError(`Terminal ${params.terminalId} not found`);
						}

						const output = term.read(params.lines);

						return {
							ok: true,
							terminalId: term.id,
							output,
							status: term.status,
							exitCode: term.exitCode,
							lines: output.length,
						};
					}

					case 'write': {
						if (!params.terminalId) {
							return createToolError(
								'terminalId is required for write operation',
							);
						}
						if (!params.input) {
							return createToolError('input is required for write operation');
						}

						const term = terminalManager.get(params.terminalId);
						if (!term) {
							return createToolError(`Terminal ${params.terminalId} not found`);
						}

						term.write(params.input);

						return {
							ok: true,
							terminalId: term.id,
							message: `Wrote ${params.input.length} characters to terminal`,
						};
					}

					case 'list': {
						const terminals = terminalManager.list();

						return {
							ok: true,
							terminals: terminals.map((t) => t.toJSON()),
							count: terminals.length,
						};
					}

					case 'kill': {
						if (!params.terminalId) {
							return createToolError(
								'terminalId is required for kill operation',
							);
						}

						await terminalManager.kill(params.terminalId);

						return {
							ok: true,
							terminalId: params.terminalId,
							message: `Killed terminal ${params.terminalId}`,
						};
					}

					default:
						return createToolError(`Unknown operation: ${operation}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return createToolError(`Terminal operation failed: ${message}`);
			}
		},
	});

	return { name: 'terminal', tool: terminal };
}
