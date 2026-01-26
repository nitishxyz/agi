import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { readFile } from 'node:fs/promises';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './read.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../../error.ts';

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
		}): Promise<
			ToolResponse<{
				path: string;
				content: string;
				size: number;
				lineRange?: string;
				totalLines?: number;
			}>
		> {
			if (!path || path.trim().length === 0) {
				return createToolError(
					'Missing required parameter: path',
					'validation',
					{
						parameter: 'path',
						value: path,
						suggestion: 'Provide a file path to read',
					},
				);
			}

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
						ok: true,
						path: req,
						content,
						size: content.length,
						lineRange: `@${startLine}-${endLine}`,
						totalLines: lines.length,
					};
				}

				return { ok: true, path: req, content, size: content.length };
			} catch (error: unknown) {
				const embedded = embeddedTextAssets[req];
				if (embedded) {
					const content = await readFile(embedded, 'utf-8');
					return { ok: true, path: req, content, size: content.length };
				}
				const isEnoent =
					error &&
					typeof error === 'object' &&
					'code' in error &&
					error.code === 'ENOENT';
				return createToolError(
					isEnoent
						? `File not found: ${req}`
						: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
					isEnoent ? 'not_found' : 'execution',
					{
						parameter: 'path',
						value: req,
						suggestion: isEnoent
							? 'Use ls or tree to find available files'
							: undefined,
					},
				);
			}
		},
	});
	return { name: 'read', tool: read };
}
