import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './tree.txt' with { type: 'text' };
import { toIgnoredBasenames } from '@/ai/tools/builtin/ignore.ts';

// description imported above

export function buildTreeTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const tree = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z.string().default('.'),
			depth: z.number().int().min(1).max(5).default(2),
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
			depth: number;
			ignore?: string[];
		}) {
			const req = expandTilde(path || '.');
			const start = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const base = start.endsWith('/') ? start.slice(0, -1) : start;
			const ignored = toIgnoredBasenames(ignore);

			async function listDir(
				dir: string,
			): Promise<Array<{ name: string; isDir: boolean }>> {
				const { exitCode, stdout, stderr } = await $`ls -1Ap ${dir}`.nothrow();
				if (exitCode !== 0) {
					const msg = String(stderr || stdout || 'ls failed').trim();
					throw new Error(`tree failed listing ${dir}: ${msg}`);
				}
				const lines = stdout.split('\n').filter(Boolean);
				return lines
					.map((name) => ({
						name: name.replace(/\/$/, ''),
						isDir: name.endsWith('/'),
					}))
					.filter((e) => !(e.isDir && ignored.has(e.name)));
			}

			const lines: string[] = [];
			async function walk(
				abs: string,
				rel: string,
				level: number,
				prefix: string,
			) {
				if (level > depth) return;
				const entries = await listDir(abs);
				const maxEntries = 200;
				const shown = entries.slice(0, maxEntries);
				const more = entries.length - shown.length;
				shown.forEach(async (e, idx) => {
					const isLast = idx === shown.length - 1;
					const connector = isLast ? '└─ ' : '├─ ';
					const line = `${prefix}${connector}${e.isDir ? '📁' : '📄'} ${rel ? `${rel}/` : ''}${e.name}`;
					lines.push(line);
					if (e.isDir && level < depth) {
						const childAbs = `${abs}/${e.name}`;
						const childRel = rel ? `${rel}/${e.name}` : e.name;
						const nextPrefix = prefix + (isLast ? '   ' : '│  ');
						await walk(childAbs, childRel, level + 1, nextPrefix);
					}
				});
				if (more > 0) lines.push(`${prefix}… and ${more} more`);
			}

			lines.push(`${'📁'} .`);
			await walk(base, '', 1, '');
			return { path: req, depth, tree: lines.join('\n') };
		},
	});
	return { name: 'tree', tool: tree };
}
