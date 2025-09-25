import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'bun';
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
			const args = ['tree'];
			if (typeof depth === 'number') args.push('-L', String(depth));
			if (ignored.size) args.push('-I', Array.from(ignored).join('|'));
			args.push('.');

			const proc = spawn({
				cmd: args,
				cwd: start,
				stdout: 'pipe',
				stderr: 'pipe',
			});
			const exitCode = await proc.exited;
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			if (exitCode !== 0) {
				const message = (stderr || stdout || 'tree failed').trim();
				throw new Error(`tree failed for ${req}: ${message}`);
			}
			const output = stdout.trimEnd();
			return { path: req, depth: depth ?? null, tree: output };
		},
	});
	return { name: 'tree', tool: tree };
}
