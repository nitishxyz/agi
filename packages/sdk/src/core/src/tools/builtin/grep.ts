import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import DESCRIPTION from './grep.txt' with { type: 'text' };
import { defaultIgnoreGlobs } from './ignore.ts';

const execAsync = promisify(exec);

function expandTilde(p: string) {
	const home = process.env.HOME || process.env.USERPROFILE || '';
	if (!home) return p;
	if (p === '~') return home;
	if (p.startsWith('~/')) return `${home}/${p.slice(2)}`;
	return p;
}

export function buildGrepTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const grep = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			pattern: z
				.string()
				.describe('Regex pattern to search for in file contents'),
			path: z
				.string()
				.optional()
				.describe('Directory to search in (default: project root).'),
			include: z
				.string()
				.optional()
				.describe('File glob to include (e.g., "*.js", "*.{ts,tsx}")'),
			ignore: z
				.array(z.string())
				.optional()
				.describe('Glob patterns to exclude from search'),
		}),
		async execute(params) {
			const pattern = String(params.pattern || '');
			if (!pattern) throw new Error('pattern is required');

			const p = expandTilde(String(params.path || '')).trim();
			const isAbs = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
			const searchPath = p ? (isAbs ? p : join(projectRoot, p)) : projectRoot;

			let cmd = `rg -n --color never`;
			for (const g of defaultIgnoreGlobs(params.ignore)) {
				cmd += ` --glob "${g.replace(/"/g, '\\"')}"`;
			}
			if (params.include) {
				cmd += ` --glob "${params.include.replace(/"/g, '\\"')}"`;
			}
			cmd += ` "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`;

			let output = '';
			try {
				const result = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
				output = result.stdout;
			} catch (error: unknown) {
				const err = error as { code?: number; stderr?: string };
				if (err.code === 1) {
					return { count: 0, matches: [] };
				}
				const err2 = error as { stderr?: string; message?: string };
				throw new Error(`ripgrep failed: ${err2.stderr || err2.message}`);
			}

			const lines = output.trim().split('\n');
			const matches: Array<{
				file: string;
				line: number;
				text: string;
			}> = [];

			for (const line of lines) {
				if (!line) continue;
				const idx1 = line.indexOf(':');
				const idx2 = idx1 === -1 ? -1 : line.indexOf(':', idx1 + 1);
				if (idx1 === -1 || idx2 === -1) continue;
				const filePath = line.slice(0, idx1);
				const lineNumStr = line.slice(idx1 + 1, idx2);
				const lineText = line.slice(idx2 + 1);
				const lineNum = parseInt(lineNumStr, 10);
				if (!filePath || !Number.isFinite(lineNum)) continue;
				matches.push({ file: filePath, line: lineNum, text: lineText });
			}

			const limit = 500;
			const truncated = matches.length > limit;
			const finalMatches = truncated ? matches.slice(0, limit) : matches;

			return {
				count: finalMatches.length,
				matches: finalMatches,
			};
		},
	});
	return { name: 'grep', tool: grep };
}
