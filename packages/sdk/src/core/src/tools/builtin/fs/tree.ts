import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './tree.txt' with { type: 'text' };
import { toIgnoredBasenames } from '../ignore.ts';

const execAsync = promisify(exec);

// description imported above

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
		}) {
			const req = expandTilde(path || '.');
			const start = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const ignored = toIgnoredBasenames(ignore);

			let cmd = 'tree';
			if (typeof depth === 'number') cmd += ` -L ${depth}`;
			if (ignored.size) {
				const pattern = Array.from(ignored).join('|');
				cmd += ` -I '${pattern.replace(/'/g, "'\\''")}'`;
			}
			cmd += ' .';

			try {
				const { stdout } = await execAsync(cmd, {
					cwd: start,
					maxBuffer: 10 * 1024 * 1024,
				});
				const output = stdout.trimEnd();
				return { path: req, depth: depth ?? null, tree: output };
			} catch (error: unknown) {
				const err = error as { stderr?: string; stdout?: string };
				const message = (err.stderr || err.stdout || 'tree failed').trim();
				throw new Error(`tree failed for ${req}: ${message}`);
			}
		},
	});
	return { name: 'tree', tool: tree };
}
