import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import fg from 'fast-glob';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import DESCRIPTION from './glob.txt' with { type: 'text' };
import { defaultIgnoreGlobs } from './ignore.ts';
import { createToolError, type ToolResponse } from '../error.ts';

function expandTilde(p: string) {
	const home = process.env.HOME || process.env.USERPROFILE || '';
	if (!home) return p;
	if (p === '~') return home;
	if (p.startsWith('~/')) return `${home}/${p.slice(2)}`;
	return p;
}

export function buildGlobTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const globTool = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			pattern: z
				.string()
				.min(1)
				.describe(
					'Glob pattern to match files (e.g., "*.ts", "**/*.tsx", "src/**/*.{js,ts}")',
				),
			path: z
				.string()
				.optional()
				.describe('Directory to search in (default: project root)'),
			ignore: z
				.array(z.string())
				.optional()
				.describe('Additional glob patterns to exclude'),
			limit: z
				.number()
				.int()
				.min(1)
				.max(1000)
				.optional()
				.default(100)
				.describe('Maximum number of files to return'),
		}),
		async execute({
			pattern,
			path = '.',
			ignore,
			limit = 100,
		}: {
			pattern: string;
			path?: string;
			ignore?: string[];
			limit?: number;
		}): Promise<
			ToolResponse<{
				count: number;
				total: number;
				files: string[];
				truncated: boolean;
			}>
		> {
			const p = expandTilde(String(path || '.')).trim();
			const isAbs = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
			const searchPath = p ? (isAbs ? p : join(projectRoot, p)) : projectRoot;

			// Build ignore patterns
			const ignorePatterns = defaultIgnoreGlobs(ignore);

			try {
				// Use fast-glob to find matching files
				const files = await fg(pattern, {
					cwd: searchPath,
					ignore: ignorePatterns,
					onlyFiles: true,
					absolute: false,
					dot: false,
				});

				// Get file stats for sorting by modification time
				const filesWithStats = await Promise.all(
					files.map(async (file) => {
						const fullPath = join(searchPath, file);
						try {
							const stats = await stat(fullPath);
							return {
								file,
								mtime: stats.mtime.getTime(),
							};
						} catch {
							return {
								file,
								mtime: 0,
							};
						}
					}),
				);

				// Sort by modification time (most recent first) and limit
				filesWithStats.sort((a, b) => b.mtime - a.mtime);
				const limitedFiles = filesWithStats.slice(0, limit).map((f) => f.file);

				return {
					ok: true,
					count: limitedFiles.length,
					total: files.length,
					files: limitedFiles,
					truncated: files.length > limit,
				};
			} catch (error: unknown) {
				const err = error as { message?: string };
				return createToolError(
					`Glob search failed: ${err.message || String(error)}`,
					'execution',
					{
						parameter: 'pattern',
						value: pattern,
						suggestion: 'Check if the pattern syntax is valid',
					},
				);
			}
		},
	});
	return { name: 'glob', tool: globTool };
}
