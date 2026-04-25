import { readFile, writeFile } from 'node:fs/promises';
import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import DESCRIPTION from './copy-into.txt' with { type: 'text' };
import { buildWriteArtifact, isAbsoluteLike, resolveSafePath } from './util.ts';
import {
	convertToLineEnding,
	detectLineEnding,
	normalizeLineEndings,
} from './edit-shared.ts';
import { assertFreshRead, rememberFileWrite } from './read-tracker.ts';
import { createToolError, type ToolResponse } from '../../error.ts';

const copyIntoSchema = z.object({
	sourcePath: z
		.string()
		.describe('Relative source file path within the project.'),
	startLine: z
		.number()
		.int()
		.min(1)
		.describe('First source line to copy, 1-indexed and inclusive.'),
	endLine: z
		.number()
		.int()
		.min(1)
		.describe('Last source line to copy, 1-indexed and inclusive.'),
	targetPath: z
		.string()
		.describe('Relative target file path within the project.'),
	insertAtLine: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe(
			'Line to insert before, 1-indexed. Use totalLines + 1 to append.',
		),
	mode: z
		.enum(['insert_before', 'insert_after', 'replace_range'])
		.optional()
		.default('insert_before')
		.describe('How to apply copied content to the target file.'),
	targetStartLine: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe('First target line to replace when mode is replace_range.'),
	targetEndLine: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe('Last target line to replace when mode is replace_range.'),
});

type CopyIntoInput = z.infer<typeof copyIntoSchema>;

function splitLinesForEdit(content: string): {
	lines: string[];
	trailingNewline: boolean;
} {
	const normalized = normalizeLineEndings(content);
	const trailingNewline = normalized.endsWith('\n');
	const lines = normalized.split('\n');
	if (trailingNewline) lines.pop();
	return { lines, trailingNewline };
}

function joinLinesForEdit(lines: string[], trailingNewline: boolean): string {
	const joined = lines.join('\n');
	return trailingNewline ? `${joined}\n` : joined;
}

function validateRelativePath(path: string, label: string): string | undefined {
	if (!path || path.trim().length === 0) {
		return `Missing required parameter: ${label}`;
	}
	if (isAbsoluteLike(path)) {
		return `Refusing to access outside project root: ${path}. Use a relative path within the project.`;
	}
	return undefined;
}

function getLineRange(
	lines: string[],
	startLine: number,
	endLine: number,
): string[] {
	if (startLine > endLine) {
		throw new Error('startLine must be less than or equal to endLine.');
	}
	if (endLine > lines.length) {
		throw new Error(
			`Source range ${startLine}-${endLine} exceeds source file length (${lines.length} lines).`,
		);
	}
	return lines.slice(startLine - 1, endLine);
}

function applyCopiedLines(
	input: CopyIntoInput,
	targetLines: string[],
	copied: string[],
): string[] {
	const mode = input.mode ?? 'insert_before';
	if (mode === 'replace_range') {
		if (
			input.targetStartLine === undefined ||
			input.targetEndLine === undefined
		) {
			throw new Error(
				'targetStartLine and targetEndLine are required when mode is replace_range.',
			);
		}
		if (input.targetStartLine > input.targetEndLine) {
			throw new Error(
				'targetStartLine must be less than or equal to targetEndLine.',
			);
		}
		if (input.targetEndLine > targetLines.length) {
			throw new Error(
				`Target range ${input.targetStartLine}-${input.targetEndLine} exceeds target file length (${targetLines.length} lines).`,
			);
		}
		return [
			...targetLines.slice(0, input.targetStartLine - 1),
			...copied,
			...targetLines.slice(input.targetEndLine),
		];
	}

	if (input.insertAtLine === undefined) {
		throw new Error(
			'insertAtLine is required for insert_before and insert_after modes.',
		);
	}
	if (input.insertAtLine > targetLines.length + 1) {
		throw new Error(
			`insertAtLine ${input.insertAtLine} exceeds append position (${targetLines.length + 1}).`,
		);
	}

	const insertIndex =
		mode === 'insert_after' ? input.insertAtLine : input.insertAtLine - 1;
	if (insertIndex > targetLines.length) {
		throw new Error(
			`insertAtLine ${input.insertAtLine} with insert_after exceeds target file length (${targetLines.length} lines).`,
		);
	}

	return [
		...targetLines.slice(0, insertIndex),
		...copied,
		...targetLines.slice(insertIndex),
	];
}

export function buildCopyIntoTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const copyInto = tool({
		description: DESCRIPTION,
		inputSchema: copyIntoSchema,
		async execute(input: CopyIntoInput): Promise<
			ToolResponse<{
				sourcePath: string;
				targetPath: string;
				linesCopied: number;
				bytes: number;
				artifact: unknown;
			}>
		> {
			const sourcePathError = validateRelativePath(
				input.sourcePath,
				'sourcePath',
			);
			if (sourcePathError) {
				return createToolError(sourcePathError, 'validation', {
					parameter: 'sourcePath',
					value: input.sourcePath,
					suggestion: 'Use a relative path within the project',
				});
			}
			const targetPathError = validateRelativePath(
				input.targetPath,
				'targetPath',
			);
			if (targetPathError) {
				return createToolError(targetPathError, 'validation', {
					parameter: 'targetPath',
					value: input.targetPath,
					suggestion: 'Use a relative path within the project',
				});
			}

			const sourceAbs = resolveSafePath(projectRoot, input.sourcePath);
			const targetAbs = resolveSafePath(projectRoot, input.targetPath);

			try {
				await assertFreshRead(projectRoot, targetAbs, input.targetPath);
				const [sourceContent, targetContent] = await Promise.all([
					readFile(sourceAbs, 'utf-8'),
					readFile(targetAbs, 'utf-8'),
				]);
				const source = splitLinesForEdit(sourceContent);
				const copiedLines = getLineRange(
					source.lines,
					input.startLine,
					input.endLine,
				);
				const target = splitLinesForEdit(targetContent);
				const nextLines = applyCopiedLines(input, target.lines, copiedLines);
				const nextNormalized = joinLinesForEdit(
					nextLines,
					target.trailingNewline,
				);
				const nextContent = convertToLineEnding(
					nextNormalized,
					detectLineEnding(targetContent),
				);

				if (nextContent === targetContent) {
					return createToolError('No changes applied.', 'validation', {
						suggestion:
							'Choose a source range or target location that changes the file',
					});
				}

				await writeFile(targetAbs, nextContent, 'utf-8');
				await rememberFileWrite(projectRoot, targetAbs);
				const artifact = await buildWriteArtifact(
					input.targetPath,
					true,
					targetContent,
					nextContent,
				);
				return {
					ok: true,
					sourcePath: input.sourcePath,
					targetPath: input.targetPath,
					linesCopied: copiedLines.length,
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
						? 'Source or target file not found.'
						: `Failed to copy into file: ${error instanceof Error ? error.message : String(error)}`,
					isEnoent ? 'not_found' : 'execution',
					{
						suggestion: isEnoent
							? 'Use read, ls, or tree to confirm both file paths first'
							: undefined,
					},
				);
			}
		},
	});

	return { name: 'copy_into', tool: copyInto };
}
