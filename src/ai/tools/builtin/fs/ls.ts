import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './ls.txt' with { type: 'text' };
import { toIgnoredBasenames } from '@/ai/tools/builtin/ignore.ts';

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
			const { exitCode, stdout, stderr } = await $`ls -1p ${abs}`.nothrow();
			if (exitCode !== 0) {
				const msg = String(stderr || stdout || 'ls failed').trim();
				throw new Error(`ls failed for ${req}: ${msg}`);
			}
			const lines = stdout.split('\n').filter(Boolean);
			const ignored = toIgnoredBasenames(ignore);
			const entries = lines
				.map((name) => ({
					name: name.replace(/\/$/, ''),
					type: name.endsWith('/') ? 'dir' : 'file',
				}))
				.filter((e) => !(e.type === 'dir' && ignored.has(e.name)));
			return { path: req, entries };
		},
	});
	return { name: 'ls', tool: ls };
}
