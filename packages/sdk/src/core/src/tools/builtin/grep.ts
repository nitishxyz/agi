import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import DESCRIPTION from './grep.txt' with { type: 'text' };
import { defaultIgnoreGlobs } from './ignore.ts';
import { createToolError, type ToolResponse } from '../error.ts';
import { resolveBinary } from '../bin-manager.ts';

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
		async execute(params: {
			pattern: string;
			path?: string;
			include?: string;
			ignore?: string[];
		}): Promise<
			ToolResponse<{
				count: number;
				matches: Array<{ file: string; line: number; text: string }>;
			}>
		> {
			const pattern = String(params.pattern || '');
			if (!pattern) {
				return createToolError('pattern is required', 'validation', {
					parameter: 'pattern',
					suggestion: 'Provide a regex pattern to search for',
				});
			}

			const p = expandTilde(String(params.path || '')).trim();
			const isAbs = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
			const searchPath = p ? (isAbs ? p : join(projectRoot, p)) : projectRoot;

			const rgBin = await resolveBinary('rg');
			const args: string[] = ['-n', '--color', 'never'];
			for (const g of defaultIgnoreGlobs(params.ignore)) {
				args.push('--glob', g);
			}
			if (params.include) {
				args.push('--glob', params.include);
			}
			args.push(pattern, searchPath);

			let output = '';
			try {
				output = await new Promise<string>((resolve, reject) => {
					const proc = spawn(rgBin, args, { cwd: projectRoot });
					let stdout = '';
					let stderr = '';
					proc.stdout.on('data', (d) => {
						stdout += d.toString();
					});
					proc.stderr.on('data', (d) => {
						stderr += d.toString();
					});
					proc.on('close', (code) => {
						if (code === 1) resolve('');
						else if (code !== 0)
							reject(new Error(stderr.trim() || 'ripgrep failed'));
						else resolve(stdout);
					});
					proc.on('error', reject);
				});
			} catch (error: unknown) {
				const err2 = error as { message?: string };
				return createToolError(`ripgrep failed: ${err2.message}`, 'execution', {
					parameter: 'pattern',
					value: pattern,
					suggestion:
						'Check if ripgrep (rg) is installed and the pattern is valid',
				});
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
				ok: true,
				count: finalMatches.length,
				matches: finalMatches,
			};
		},
	});
	return { name: 'grep', tool: grep };
}
