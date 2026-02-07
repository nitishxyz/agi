import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import DESCRIPTION from './multiedit.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';
import { replace } from './edit/replacers.ts';
import { buildWriteArtifact } from './fs/util.ts';

export function buildMultiEditTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const multiEditTool = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			filePath: z
				.string()
				.describe(
					'The path to the file to modify (relative to project root or absolute)',
				),
			edits: z
				.array(
					z.object({
						oldString: z.string().describe('The text to replace'),
						newString: z
							.string()
							.describe('The text to replace it with'),
						replaceAll: z
							.boolean()
							.optional()
							.default(false)
							.describe(
								'Replace all occurrences of oldString (default false)',
							),
					}),
				)
				.describe(
					'Array of edit operations to perform sequentially on the file',
				),
		}),
		async execute({
			filePath,
			edits,
		}: {
			filePath: string;
			edits: Array<{
				oldString: string;
				newString: string;
				replaceAll?: boolean;
			}>;
		}): Promise<
			ToolResponse<{
				output: string;
				filePath: string;
				editsApplied: number;
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

			if (!edits || edits.length === 0) {
				return createToolError(
					'Missing required parameter: edits',
					'validation',
					{
						parameter: 'edits',
						suggestion: 'Provide at least one edit operation',
					},
				);
			}

			const absPath = isAbsolute(filePath)
				? filePath
				: join(projectRoot, filePath);
			const relPath = relative(projectRoot, absPath);

			try {
				let contentOld: string;
				let isNew = false;

				if (edits[0].oldString === '') {
					await mkdir(dirname(absPath), { recursive: true });
					contentOld = '';
					isNew = true;
				} else {
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
								suggestion:
									'Provide a path to a file, not a directory',
							},
						);
					}
					contentOld = await readFile(absPath, 'utf-8');
				}

				const originalContent = contentOld;
				let current = contentOld;

				for (let i = 0; i < edits.length; i++) {
					const edit = edits[i];

					if (edit.oldString === '' && i === 0 && isNew) {
						current = edit.newString;
						continue;
					}

					if (edit.oldString === edit.newString) {
						return createToolError(
							`Edit ${i + 1}: oldString and newString must be different`,
							'validation',
							{
								parameter: `edits[${i}]`,
								suggestion:
									'Provide different values for oldString and newString',
							},
						);
					}

					try {
						current = replace(
							current,
							edit.oldString,
							edit.newString,
							edit.replaceAll ?? false,
						);
					} catch (error) {
						const message =
							error instanceof Error
								? error.message
								: String(error);
						return createToolError(
							`Edit ${i + 1} failed: ${message}`,
							'execution',
							{
								parameter: `edits[${i}]`,
								suggestion:
									'Check that earlier edits did not change the text this edit targets',
							},
						);
					}
				}

				await writeFile(absPath, current, 'utf-8');

				const artifact = await buildWriteArtifact(
					relPath,
					!isNew,
					originalContent,
					current,
				);

				return {
					ok: true,
					output: `Applied ${edits.length} edit${edits.length === 1 ? '' : 's'} successfully.`,
					filePath: relPath,
					editsApplied: edits.length,
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

	return { name: 'multiedit', tool: multiEditTool };
}
