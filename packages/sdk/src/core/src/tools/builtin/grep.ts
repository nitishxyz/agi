import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
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
			} catch (error: any) {
				if (error.code === 1) {
					return {
						title: pattern,
						metadata: { matches: 0, truncated: false },
						output: 'No files found',
					};
				}
				throw new Error(`ripgrep failed: ${error.stderr || error.message}`);
			}

			const lines = output.trim().split('\n');
			const matches: Array<{
				path: string;
				modTime: number;
				lineNum: number;
				lineText: string;
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
				const stats = await stat(filePath)
					.then((s) => s.mtime.getTime())
					.catch(() => 0);
				matches.push({ path: filePath, modTime: stats, lineNum, lineText });
			}

			matches.sort((a, b) => b.modTime - a.modTime);

			const limit = 100;
			const truncated = matches.length > limit;
			const finalMatches = truncated ? matches.slice(0, limit) : matches;

			if (finalMatches.length === 0) {
				return {
					title: pattern,
					metadata: { matches: 0, truncated: false },
					output: 'No files found',
				};
			}

			const outputLines = [`Found ${finalMatches.length} matches`];
			let currentFile = '';
			for (const match of finalMatches) {
				if (currentFile !== match.path) {
					if (currentFile !== '') outputLines.push('');
					currentFile = match.path;
					outputLines.push(`${match.path}:`);
				}
				outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`);
			}
			if (truncated) {
				outputLines.push('');
				outputLines.push(
					'(Results are truncated. Consider using a more specific path or pattern.)',
				);
			}

			return {
				title: pattern,
				metadata: { matches: finalMatches.length, truncated },
				output: outputLines.join('\n'),
			};
		},
	});
	return { name: 'grep', tool: grep };
}
