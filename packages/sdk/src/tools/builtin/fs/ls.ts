import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'bun';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './ls.txt' with { type: 'text' };
import { toIgnoredBasenames } from '../ignore.ts';

// description imported above

export function buildLsTool(projectRoot: string): { name: string; tool: Tool } {
	const ls = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z
				.string()
				.default('.')
				.describe(
					"Directory path. Relative to project root by default; absolute ('/...') and home ('~/...') paths are allowed.",
				),
			ignore: z
				.array(z.string())
				.optional()
				.describe('List of directory names/globs to ignore'),
		}),
		async execute({ path, ignore }: { path: string; ignore?: string[] }) {
			const req = expandTilde(path || '.');
			const abs = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const ignored = toIgnoredBasenames(ignore);
			const proc = spawn({
				cmd: ['ls', '-1p'],
				cwd: abs,
				stdout: 'pipe',
				stderr: 'pipe',
			});
			const exitCode = await proc.exited;
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			if (exitCode !== 0) {
				const message = (stderr || stdout || 'ls failed').trim();
				throw new Error(`ls failed for ${req}: ${message}`);
			}
			const entries = stdout
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && !line.startsWith('.'))
				.map((line) => ({
					name: line.replace(/\/$/, ''),
					type: line.endsWith('/') ? 'dir' : 'file',
				}))
				.filter((entry) => !(entry.type === 'dir' && ignored.has(entry.name)));
			return { path: req, entries };
		},
	});
	return { name: 'ls', tool: ls };
}
