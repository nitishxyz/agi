import { readFile, writeFile } from 'node:fs/promises';
import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import DESCRIPTION from './multiedit.txt' with { type: 'text' };
import { buildWriteArtifact, isAbsoluteLike, resolveSafePath } from './util.ts';
import { applyStringEdit } from './edit-shared.ts';
import { assertFreshRead, rememberFileWrite } from './read-tracker.ts';
import { createToolError, type ToolResponse } from '../../error.ts';

const multiEditSchema = z.object({
	path: z
		.string()
		.describe(
			'Relative file path within the project. Absolute paths are not allowed.',
		),
	edits: z
		.array(
			z.object({
				oldString: z.string().describe('Exact text to replace'),
				newString: z.string().describe('Replacement text'),
				replaceAll: z
					.boolean()
					.optional()
					.default(false)
					.describe('Replace every matching occurrence for this edit'),
			}),
		)
		.min(1)
		.describe('Edits to apply sequentially to the same file'),
});

export function buildMultiEditTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const multiedit = tool({
		description: DESCRIPTION,
		inputSchema: multiEditSchema,
		async execute({ path, edits }: z.infer<typeof multiEditSchema>): Promise<
			ToolResponse<{
				path: string;
				editsApplied: number;
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
						suggestion: 'Provide a relative file path to edit',
					},
				);
			}
			if (isAbsoluteLike(path)) {
				return createToolError(
					`Refusing to edit outside project root: ${path}`,
					'permission',
					{
						parameter: 'path',
						value: path,
						suggestion: 'Use a relative path within the project',
					},
				);
			}

			const abs = resolveSafePath(projectRoot, path);
			try {
				await assertFreshRead(projectRoot, abs, path);
				const original = await readFile(abs, 'utf-8');
				let nextContent = original;
				for (let i = 0; i < edits.length; i++) {
					const edit = edits[i];
					try {
						nextContent = applyStringEdit(
							nextContent,
							edit.oldString,
							edit.newString,
							edit.replaceAll,
						).content;
					} catch (error: unknown) {
						throw new Error(
							`Edit ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}

				if (nextContent === original) {
					return createToolError('No changes applied.', 'validation', {
						suggestion:
							'Adjust your edits so the file content actually changes',
					});
				}

				await writeFile(abs, nextContent, 'utf-8');
				await rememberFileWrite(projectRoot, abs);
				const artifact = await buildWriteArtifact(
					path,
					true,
					original,
					nextContent,
				);
				return {
					ok: true,
					path,
					editsApplied: edits.length,
					bytes: nextContent.length,
					artifact,
				};
			} catch (error: unknown) {
				const isEnoent =
					error &&
					typeof error === 'object' &&
					'code' in error &&
					error.code === 'ENOENT';
				return createToolError(
					isEnoent
						? `File not found: ${path}`
						: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
					isEnoent ? 'not_found' : 'execution',
					{
						parameter: 'path',
						value: path,
						suggestion: isEnoent
							? 'Use read or ls to confirm the file path first'
							: undefined,
					},
				);
			}
		},
	});

	return { name: 'multiedit', tool: multiedit };
}
