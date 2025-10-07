import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './read.txt' with { type: 'text' };

const embeddedTextAssets: Record<string, string> = {};

export function buildReadTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const read = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z
				.string()
				.describe(
					"File path. Relative to project root by default; absolute ('/...') and home ('~/...') paths are allowed.",
				),
			startLine: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe(
					'Starting line number (1-indexed). If provided, only reads lines from startLine to endLine.',
				),
			endLine: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe(
					'Ending line number (1-indexed, inclusive). Required if startLine is provided.',
				),
		}),
		async execute({
			path,
			startLine,
			endLine,
		}: {
			path: string;
			startLine?: number;
			endLine?: number;
		}) {
			const req = expandTilde(path);
			const abs = isAbsoluteLike(req) ? req : resolveSafePath(projectRoot, req);

			try {
				let content = await readFile(abs, 'utf-8');

				if (startLine !== undefined && endLine !== undefined) {
					const lines = content.split('\n');
					const start = Math.max(1, startLine) - 1;
					const end = Math.min(lines.length, endLine);
					const selectedLines = lines.slice(start, end);
					content = selectedLines.join('\n');
					return {
						path: req,
						content,
						size: content.length,
						lineRange: `@${startLine}-${endLine}`,
						totalLines: lines.length,
					};
				}

				return { path: req, content, size: content.length };
			} catch (_error: unknown) {
				const embedded = embeddedTextAssets[req];
				if (embedded) {
					const content = await readFile(embedded, 'utf-8');
					return { path: req, content, size: content.length };
				}
				throw new Error(`File not found: ${req}`);
			}
		},
	});
	return { name: 'read', tool: read };
}
