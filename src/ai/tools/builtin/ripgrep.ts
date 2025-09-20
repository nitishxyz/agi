import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';

export function buildRipgrepTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const rg = tool({
		description:
			'Search files using ripgrep (rg). Returns matches with file, line, and text.',
		inputSchema: z.object({
			query: z.string().min(1).describe('Search pattern (regex by default)'),
			path: z
				.string()
				.optional()
				.default('.')
				.describe('Relative path to search in'),
			ignoreCase: z.boolean().optional().default(false),
			glob: z
				.array(z.string())
				.optional()
				.describe('One or more glob patterns to include'),
			maxResults: z.number().int().min(1).max(5000).optional().default(500),
		}),
		async execute({
			query,
			path = '.',
			ignoreCase,
			glob,
			maxResults = 500,
		}: {
			query: string;
			path?: string;
			ignoreCase?: boolean;
			glob?: string[];
			maxResults?: number;
		}) {
			const target = path?.trim() ? `${projectRoot}/${path}` : projectRoot;
			const args = ['--no-heading', '--line-number', '--color=never'];
			if (ignoreCase) args.push('-i');
			if (Array.isArray(glob)) for (const g of glob) args.push('-g', g);
			args.push('--max-count', String(maxResults));
			args.push(query, target);
			try {
				const output = await $`rg ${args}`.quiet().text();
				const lines = output.split('\n').filter(Boolean).slice(0, maxResults);
				const matches = lines.map((l) => {
					const m = l.match(/^(.*?):(\d+):(.*)$/);
					if (!m) return { file: '', line: 0, text: l };
					return { file: m[1], line: Number(m[2]), text: m[3] };
				});
				return { count: matches.length, matches };
			} catch (err) {
				const stderr = (err as { stderr?: string })?.stderr ?? String(err);
				return { count: 0, matches: [], error: stderr?.trim() };
			}
		},
	});
	return { name: 'ripgrep', tool: rg };
}
