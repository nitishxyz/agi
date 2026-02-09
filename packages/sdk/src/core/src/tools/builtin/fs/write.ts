import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
	buildWriteArtifact,
	resolveSafePath,
	expandTilde,
	isAbsoluteLike,
} from './util.ts';
import DESCRIPTION from './write.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../../error.ts';

export function buildWriteTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const write = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z
				.string()
				.describe(
					'Relative file path within the project. Writes outside the project are not allowed.',
				),
			content: z.string().describe('Text content to write'),
			createDirs: z.boolean().optional().default(true),
		}),
		async execute({
			path,
			content,
			createDirs,
		}: {
			path: string;
			content: string;
			createDirs?: boolean;
		}): Promise<
			ToolResponse<{
				path: string;
				bytes: number;
				artifact: unknown;
			}>
		> {
			if (!path || path.trim().length === 0) {
				return createToolError(
					'Missing required parameter: path',
					'validation',
					{
						parameter: 'path',
						value: path,
						suggestion: 'Provide a file path to write',
					},
				);
			}

			const req = expandTilde(path);
			if (isAbsoluteLike(req)) {
				return createToolError(
					`Refusing to write outside project root: ${req}. Use a relative path within the project.`,
					'permission',
					{
						parameter: 'path',
						value: req,
						suggestion: 'Use a relative path within the project',
					},
				);
			}
			const abs = resolveSafePath(projectRoot, req);

			try {
				if (createDirs) {
					const dirPath = dirname(abs);
					await mkdir(dirPath, { recursive: true });
				}
				let existed = false;
				let oldText = '';
				try {
					oldText = await readFile(abs, 'utf-8');
					existed = true;
				} catch {}
				await writeFile(abs, content);
				const artifact = await buildWriteArtifact(
					req,
					existed,
					oldText,
					content,
				);
				return {
					ok: true,
					path: req,
					bytes: content.length,
					artifact,
				};
			} catch (error: unknown) {
				return createToolError(
					`Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
					'execution',
					{
						parameter: 'path',
						value: req,
					},
				);
			}
		},
	});
	return { name: 'write', tool: write };
}
