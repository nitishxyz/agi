import { tool, type Tool } from 'ai';
import { z } from 'zod';
import DESCRIPTION from './patch.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';
import { applyPatchOperations } from './patch/apply.ts';
import { parsePatchInput } from './patch/parse.ts';
import type {
	AppliedPatchOperation,
	PatchOperation,
	RejectedPatch,
} from './patch/types.ts';

function serializeChanges(operations: AppliedPatchOperation[]) {
	return operations.map((operation) => ({
		filePath: operation.filePath,
		kind: operation.kind,
		hunks: operation.hunks.map((hunk) => ({
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			additions: hunk.additions,
			deletions: hunk.deletions,
			context: hunk.header.context,
		})),
	}));
}

function serializeRejected(rejected: RejectedPatch[]) {
	if (rejected.length === 0) return undefined;
	return rejected.map((item) => ({
		filePath: item.filePath,
		kind: item.kind,
		reason: item.reason,
		hunks:
			item.operation.kind === 'update'
				? item.operation.hunks.map((hunk) => ({
						oldStart: hunk.header.oldStart,
						oldLines: hunk.header.oldLines,
						newStart: hunk.header.newStart,
						newLines: hunk.header.newLines,
						context: hunk.header.context,
						lines: hunk.lines.map((line) => ({
							kind: line.kind,
							content: line.content,
						})),
					}))
				: undefined,
	}));
}

export function buildApplyPatchTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const applyPatch = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			patch: z.string().min(1).describe('Unified diff patch content'),
			allowRejects: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Allow hunks to be rejected without failing the whole operation',
				),
			fuzzyMatch: z
				.boolean()
				.optional()
				.default(true)
				.describe(
					'Enable fuzzy matching with whitespace normalization (converts tabs to spaces for matching)',
				),
		}),
		async execute({
			patch,
			allowRejects = false,
			fuzzyMatch = true,
		}: {
			patch: string;
			allowRejects?: boolean;
			fuzzyMatch?: boolean;
		}): Promise<
			ToolResponse<{
				output: string;
				changes: unknown[];
				artifact: unknown;
				rejected?: unknown[];
			}>
		> {
			if (!patch || patch.trim().length === 0) {
				return createToolError(
					'Missing required parameter: patch',
					'validation',
					{
						parameter: 'patch',
						value: patch,
						suggestion: 'Provide patch content in enveloped format',
					},
				);
			}

			let operations: PatchOperation[];
			try {
				const parsed = parsePatchInput(patch);
				operations = parsed.operations;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return createToolError(message, 'validation', {
					parameter: 'patch',
					suggestion:
						'Provide patch content using the enveloped format (*** Begin Patch ... *** End Patch) or standard unified diff format (---/+++ headers).',
				});
			}

			try {
				const result = await applyPatchOperations(projectRoot, operations, {
					useFuzzy: fuzzyMatch,
					allowRejects,
				});

				const changes = serializeChanges(result.operations);
				const rejected = serializeRejected(result.rejected);

				const output: string[] = [];
				if (result.operations.length > 0) {
					output.push(
						`Applied ${result.operations.length} operation${result.operations.length === 1 ? '' : 's'}`,
					);
				}
				if (allowRejects && result.rejected.length > 0) {
					output.push(
						`Skipped ${result.rejected.length} operation${result.rejected.length === 1 ? '' : 's'} due to mismatches`,
					);
				}
				if (output.length === 0) {
					output.push('No changes applied');
				}

				return {
					ok: true,
					output: output.join('; '),
					changes,
					artifact: {
						kind: 'file_diff',
						patch: result.normalizedPatch,
						summary: result.summary,
					},
					rejected,
				};
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return createToolError(
					`Failed to apply patch: ${errorMessage}`,
					'execution',
					{
						suggestion:
							'Check that the patch format is correct and target files exist',
					},
				);
			}
		},
	});

	return { name: 'apply_patch', tool: applyPatch };
}
