import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import { join, isAbsolute, resolve } from 'node:path';
import DESCRIPTION from './glob.txt' with { type: 'text' };
import { defaultIgnoreGlobs } from './ignore.ts';

// description imported above

export function buildGlobTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const glob = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			pattern: z
				.string()
				.describe('Glob pattern to match files (e.g., "**/*.ts")'),
			path: z
				.string()
				.optional()
				.describe('Directory to search in. Defaults to the project root.'),
			ignore: z
				.array(z.string())
				.optional()
				.describe('Glob patterns to exclude from results'),
		}),
		async execute(params) {
			const limit = 100;
			const search = params.path
				? isAbsolute(params.path)
					? params.path
					: join(projectRoot, params.path)
				: projectRoot;
			const args = ['--files', '--color', 'never', '-g', params.pattern];
			for (const g of defaultIgnoreGlobs(params.ignore)) {
				args.push('-g', g);
			}
			const { exitCode, stdout, stderr } = await $`rg ${args}`
				.cwd(search)
				.nothrow();
			if (exitCode !== 0) {
				const msg = (stderr || stdout || 'rg failed').toString().trim();
				throw new Error(`glob failed: ${msg}`);
			}
			const lines = stdout.split('\n').filter(Boolean);
			const items: Array<{ path: string; mtime: number }> = [];
			let truncated = false;
			for (const rel of lines) {
				if (items.length >= limit) {
					truncated = true;
					break;
				}
				const full = resolve(search, rel);
				const mtime = await Bun.file(full)
					.stat()
					.then((s) => s.mtime.getTime())
					.catch(() => 0);
				items.push({ path: full, mtime });
			}
			items.sort((a, b) => b.mtime - a.mtime);
			const output: string[] = [];
			if (items.length === 0) output.push('No files found');
			else {
				output.push(...items.map((i) => i.path));
				if (truncated) {
					output.push('');
					output.push(
						'(Results are truncated. Consider using a more specific path or pattern.)',
					);
				}
			}
			return {
				title: isAbsolute(search) ? search : join(projectRoot, search),
				metadata: { count: items.length, truncated },
				output: output.join('\n'),
			};
		},
	});
	return { name: 'glob', tool: glob };
}
