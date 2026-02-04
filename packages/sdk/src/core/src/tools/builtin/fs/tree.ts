import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './tree.txt' with { type: 'text' };
import { toIgnoredBasenames } from '../ignore.ts';
import { createToolError, type ToolResponse } from '../../error.ts';

async function walkTree(
	dir: string,
	ignored: Set<string>,
	maxDepth: number | null,
	currentDepth: number,
	prefix: string,
): Promise<{ lines: string[]; dirs: number; files: number }> {
	let dirs = 0;
	let files = 0;
	const lines: string[] = [];

	if (maxDepth !== null && currentDepth >= maxDepth)
		return { lines, dirs, files };

	try {
		const rawEntries = await fs.readdir(dir, { withFileTypes: true });
		const entries = rawEntries.map((e) => ({
			name: String(e.name),
			isDir: e.isDirectory(),
		}));

		const filtered = entries
			.filter((e) => !e.name.startsWith('.'))
			.filter((e) => !(e.isDir && ignored.has(e.name)))
			.sort((a, b) => {
				if (a.isDir && !b.isDir) return -1;
				if (!a.isDir && b.isDir) return 1;
				return a.name.localeCompare(b.name);
			});

		for (let i = 0; i < filtered.length; i++) {
			const entry = filtered[i];
			const isLast = i === filtered.length - 1;
			const connector = isLast ? '└── ' : '├── ';
			const childPrefix = isLast ? '    ' : '│   ';

			if (entry.isDir) {
				dirs++;
				lines.push(`${prefix}${connector}${entry.name}`);
				const sub = await walkTree(
					join(dir, entry.name),
					ignored,
					maxDepth,
					currentDepth + 1,
					`${prefix}${childPrefix}`,
				);
				lines.push(...sub.lines);
				dirs += sub.dirs;
				files += sub.files;
			} else {
				files++;
				let lineCount = '';
				try {
					const content = await fs.readFile(join(dir, entry.name), 'utf-8');
					const count = content.split('\n').length;
					lineCount = ` (${count} lines)`;
				} catch {}
				lines.push(`${prefix}${connector}${entry.name}${lineCount}`);
			}
		}
	} catch {
		return { lines, dirs, files };
	}

	return { lines, dirs, files };
}

export function buildTreeTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const tree = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z.string().default('.'),
			depth: z
				.number()
				.int()
				.min(1)
				.max(20)
				.optional()
				.describe('Optional depth limit (defaults to full depth).'),
			ignore: z
				.array(z.string())
				.optional()
				.describe('List of directory names/globs to ignore'),
		}),
		async execute({
			path,
			depth,
			ignore,
		}: {
			path: string;
			depth?: number;
			ignore?: string[];
		}): Promise<
			ToolResponse<{ path: string; depth: number | null; tree: string }>
		> {
			const req = expandTilde(path || '.');
			const start = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const ignored = toIgnoredBasenames(ignore);

			try {
				await fs.access(start);
			} catch {
				return createToolError(
					`tree failed for ${req}: directory not found`,
					'not_found',
					{
						parameter: 'path',
						value: req,
						suggestion: 'Check if the directory exists',
					},
				);
			}

			try {
				const result = await walkTree(start, ignored, depth ?? null, 0, '');
				const header = '.';
				const summary = `\n${result.dirs} director${result.dirs === 1 ? 'y' : 'ies'}, ${result.files} file${result.files === 1 ? '' : 's'}`;
				const output = [header, ...result.lines, summary].join('\n');
				return { ok: true, path: req, depth: depth ?? null, tree: output };
			} catch (error: unknown) {
				const err = error as { message?: string };
				return createToolError(
					`tree failed for ${req}: ${err.message || 'unknown error'}`,
					'execution',
					{
						parameter: 'path',
						value: req,
						suggestion: 'Check if the directory exists and is accessible',
					},
				);
			}
		},
	});
	return { name: 'tree', tool: tree };
}
