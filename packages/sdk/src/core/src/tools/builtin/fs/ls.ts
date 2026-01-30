import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { promises as fs } from 'node:fs';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './ls.txt' with { type: 'text' };
import { toIgnoredBasenames } from '../ignore.ts';
import { createToolError, type ToolResponse } from '../../error.ts';

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
		async execute({
			path,
			ignore,
		}: {
			path: string;
			ignore?: string[];
		}): Promise<
			ToolResponse<{
				path: string;
				entries: Array<{ name: string; type: string }>;
			}>
		> {
			const req = expandTilde(path || '.');
			const abs = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const ignored = toIgnoredBasenames(ignore);

			try {
				const dirents = await fs.readdir(abs, { withFileTypes: true });
				const entries = dirents
					.filter((d) => !String(d.name).startsWith('.'))
					.map((d) => ({
						name: String(d.name),
						type: d.isDirectory() ? 'dir' : 'file',
					}))
					.filter((entry) => !(entry.type === 'dir' && ignored.has(entry.name)))
					.sort((a, b) => a.name.localeCompare(b.name));
				return { ok: true, path: req, entries };
			} catch (error: unknown) {
				const err = error as { code?: string; message?: string };
				const message = err.message || 'ls failed';
				return createToolError(
					`ls failed for ${req}: ${message}`,
					err.code === 'ENOENT' ? 'not_found' : 'execution',
					{
						parameter: 'path',
						value: req,
						suggestion:
							err.code === 'ENOENT'
								? 'Check if the directory exists'
								: 'Check if the directory exists and is accessible',
					},
				);
			}
		},
	});
	return { name: 'ls', tool: ls };
}
