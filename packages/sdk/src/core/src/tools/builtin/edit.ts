import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import DESCRIPTION from './edit.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';
import { replace } from './edit/replacers.ts';
import { buildWriteArtifact } from './fs/util.ts';

export function buildEditTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const editTool = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			filePath: z
				.string()
				.describe('The path to the file to modify (relative to project root or absolute)'),
			oldString: z.string().describe('The text to replace'),
			newString: z
				.string()
				.describe(
					'The text to replace it with (must be different from oldString)',
				),
			replaceAll: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Replace all occurrences of oldString (default false)',
				),
		}),
		async execute({
			filePath,
			oldString,
			newString,
			replaceAll: replaceAllFlag = false,
		}: {
			filePath: string;
			oldString: string;
			newString: string;
			replaceAll?: boolean;
		}): Promise<
			ToolResponse<{
				output: string;
				filePath: string;
				artifact: unknown;
			}>
		> {
			if (!filePath || filePath.trim().length === 0) {
				return createToolError(
					'Missing required parameter: filePath',
					'validation',
					{
						parameter: 'filePath',
						value: filePath,
						suggestion: 'Provide a file path to edit',
					},
				);
			}

			if (oldString === newString) {
				return createToolError(
					'oldString and newString must be different',
					'validation',
					{
						parameter: 'oldString',
						suggestion:
							'Provide different values for oldString and newString',
					},
				);
			}

			const absPath = isAbsolute(filePath)
				? filePath
				: join(projectRoot, filePath);
			const relPath = relative(projectRoot, absPath);

			try {
				if (oldString === '') {
					await mkdir(dirname(absPath), { recursive: true });
					await writeFile(absPath, newString, 'utf-8');
					const artifact = await buildWriteArtifact(
						relPath,
						false,
						'',
						newString,
					);
					return {
						ok: true,
						output: 'File created successfully.',
						filePath: relPath,
						artifact,
					};
				}

				const fileStat = await stat(absPath).catch(() => null);
				if (!fileStat) {
					return createToolError(
						`File ${relPath} not found`,
						'not_found',
						{
							parameter: 'filePath',
							value: relPath,
							suggestion: 'Check the file path exists',
						},
					);
				}
				if (fileStat.isDirectory()) {
					return createToolError(
						`Path is a directory, not a file: ${relPath}`,
						'validation',
						{
							parameter: 'filePath',
							value: relPath,
							suggestion: 'Provide a path to a file, not a directory',
						},
					);
				}

				const contentOld = await readFile(absPath, 'utf-8');
				let contentNew: string;

				try {
					contentNew = replace(
						contentOld,
						oldString,
						newString,
						replaceAllFlag,
					);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					return createToolError(message, 'execution', {
						suggestion:
							message.includes('multiple matches')
								? 'Provide more surrounding context in oldString to uniquely identify the match, or use replaceAll: true'
								: 'Verify the oldString matches the file content exactly',
					});
				}

				await writeFile(absPath, contentNew, 'utf-8');

				const artifact = await buildWriteArtifact(
					relPath,
					true,
					contentOld,
					contentNew,
				);

				return {
					ok: true,
					output: 'Edit applied successfully.',
					filePath: relPath,
					artifact,
				};
			} catch (error: unknown) {
				return createToolError(
					`Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
					'execution',
					{
						parameter: 'filePath',
						value: relPath,
					},
				);
			}
		},
	});

	return { name: 'edit', tool: editTool };
}
