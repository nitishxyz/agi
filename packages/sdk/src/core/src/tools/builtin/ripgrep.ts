import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import DESCRIPTION from './ripgrep.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';
import { resolveBinary } from '../bin-manager.ts';

export function buildRipgrepTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const rg = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			query: z.string().min(1).describe('Search pattern (regex by default)'),
			path: z
				.string()
				.optional()
				.default('.')
				.describe('Relative path to search in'),
			ignoreCase: z.boolean().optional().default(false),
			glob: z
				.array(z.string())
				.optional()
				.describe('One or more glob patterns to include'),
		maxResults: z.number().int().min(1).max(5000).optional().default(100),
		}),
		async execute({
			query,
			path = '.',
			ignoreCase,
			glob,
		maxResults = 100,
	}: {
			query: string;
			path?: string;
			ignoreCase?: boolean;
			glob?: string[];
			maxResults?: number;
		}): Promise<
			ToolResponse<{
				count: number;
				matches: Array<{ file: string; line: number; text: string }>;
			}>
		> {
			function expandTilde(p: string) {
				const home = process.env.HOME || process.env.USERPROFILE || '';
				if (!home) return p;
				if (p === '~') return home;
				if (p.startsWith('~/')) return `${home}/${p.slice(2)}`;
				return p;
			}
			const p = expandTilde(String(path ?? '.')).trim();
			const isAbs = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
			const target = p ? (isAbs ? p : join(projectRoot, p)) : projectRoot;
			const args = ['--no-heading', '--line-number', '--color=never'];
			if (ignoreCase) args.push('-i');
			if (Array.isArray(glob)) for (const g of glob) args.push('-g', g);
			args.push('--max-count', String(maxResults));
			args.push(query);
			args.push(target);

			try {
				const rgBin = await resolveBinary('rg');
				return await new Promise((resolve) => {
					const proc = spawn(rgBin, args, { cwd: projectRoot });
					let stdout = '';
					let stderr = '';

					proc.stdout.on('data', (data) => {
						stdout += data.toString();
					});

					proc.stderr.on('data', (data) => {
						stderr += data.toString();
					});

					proc.on('close', (code) => {
						if (code !== 0 && code !== 1) {
							resolve(
								createToolError(
									stderr.trim() || 'ripgrep failed',
									'execution',
									{
										suggestion:
											'Check if ripgrep (rg) is installed and the query is valid',
									},
								),
							);
							return;
						}

						const lines = stdout
							.split('\n')
							.filter(Boolean)
							.slice(0, maxResults);
					const TEXT_MAX = 200;
					const matches = lines.map((l) => {
						const m = l.match(/^(.+?):(\d+):(.*)$/s);
						if (!m) return { file: '', line: 0, text: l.length > TEXT_MAX ? l.slice(0, TEXT_MAX) + '…' : l };
						const file = m[1];
						const line = Number.parseInt(m[2], 10);
						const raw = m[3];
						const text = raw.length > TEXT_MAX ? raw.slice(0, TEXT_MAX) + '…' : raw;
						return { file, line, text };
					});
						resolve({ ok: true, count: matches.length, matches });
					});

					proc.on('error', (err) => {
						resolve(
							createToolError(String(err), 'execution', {
								suggestion: 'Ensure ripgrep (rg) is installed',
							}),
						);
					});
				});
			} catch (err) {
				return createToolError(String(err), 'execution', {
					suggestion: 'Ensure ripgrep (rg) is installed',
				});
			}
		},
	});
	return { name: 'ripgrep', tool: rg };
}
