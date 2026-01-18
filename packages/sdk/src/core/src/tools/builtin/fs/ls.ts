import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './ls.txt' with { type: 'text' };
import { toIgnoredBasenames } from '../ignore.ts';
import { createToolError, type ToolResponse } from '../../error.ts';

const execAsync = promisify(exec);

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
		async execute({
			path,
			ignore,
		}: {
			path: string;
			ignore?: string[];
		}): Promise<
			ToolResponse<{ path: string; entries: Array<{ name: string; type: string }> }>
		> {
			const req = expandTilde(path || '.');
			const abs = isAbsoluteLike(req)
				? req
				: resolveSafePath(projectRoot, req || '.');
			const ignored = toIgnoredBasenames(ignore);

			try {
				const { stdout } = await execAsync('ls -1p', {
					cwd: abs,
					maxBuffer: 10 * 1024 * 1024,
				});
				const entries = stdout
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line.length > 0 && !line.startsWith('.'))
					.map((line) => ({
						name: line.replace(/\/$/, ''),
						type: line.endsWith('/') ? 'dir' : 'file',
					}))
					.filter(
					(entry) => !(entry.type === 'dir' && ignored.has(entry.name)),
				);
				return { ok: true, path: req, entries };
			} catch (error: unknown) {
				const err = error as { stderr?: string; stdout?: string };
				const message = (err.stderr || err.stdout || 'ls failed').trim();
				return createToolError(
					`ls failed for ${req}: ${message}`,
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
	return { name: 'ls', tool: ls };
}
