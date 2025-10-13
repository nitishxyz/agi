import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import DESCRIPTION from './patch.txt' with { type: 'text' };
import { createToolError, type ToolResponse } from '../error.ts';

interface PatchAddOperation {
	kind: 'add';
	filePath: string;
	lines: string[];
}

interface PatchDeleteOperation {
	kind: 'delete';
	filePath: string;
}

interface PatchUpdateOperation {
	kind: 'update';
	filePath: string;
	hunks: PatchHunk[];
}

type ParsedPatchOperation =
	| PatchAddOperation
	| PatchDeleteOperation
	| PatchUpdateOperation;

type PatchLineKind = 'context' | 'add' | 'remove';

interface PatchHunkLine {
	kind: PatchLineKind;
	content: string;
}

interface PatchHunkHeader {
	oldStart?: number;
	oldLines?: number;
	newStart?: number;
	newLines?: number;
	context?: string;
}

interface PatchHunk {
	header: PatchHunkHeader;
	lines: PatchHunkLine[];
}

interface PatchStats {
	additions: number;
	deletions: number;
}

interface AppliedHunkResult {
	header: PatchHunkHeader;
	lines: PatchHunkLine[];
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	additions: number;
	deletions: number;
}

interface AppliedOperationRecord {
	kind: 'add' | 'delete' | 'update';
	filePath: string;
	operation: ParsedPatchOperation;
	stats: PatchStats;
	hunks: AppliedHunkResult[];
}

const PATCH_BEGIN_MARKER = '*** Begin Patch';
const PATCH_END_MARKER = '*** End Patch';
const PATCH_ADD_PREFIX = '*** Add File:';
const PATCH_UPDATE_PREFIX = '*** Update File:';
const PATCH_DELETE_PREFIX = '*** Delete File:';

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
	return (
		value instanceof Error &&
		typeof (value as NodeJS.ErrnoException).code === 'string'
	);
}

function splitLines(value: string): { lines: string[]; newline: string } {
	const newline = value.includes('\r\n') ? '\r\n' : '\n';
	const normalized = newline === '\n' ? value : value.replace(/\r\n/g, '\n');
	const parts = normalized.split('\n');

	if (parts.length > 0 && parts[parts.length - 1] === '') {
		parts.pop();
	}

	return { lines: parts, newline };
}

function joinLines(lines: string[], newline: string): string {
	const base = lines.join('\n');
	return newline === '\n' ? base : base.replace(/\n/g, newline);
}

function ensureTrailingNewline(lines: string[]) {
	if (lines.length === 0 || lines[lines.length - 1] !== '') {
		lines.push('');
	}
}

/**
 * Normalize whitespace for fuzzy matching.
 * Converts tabs to spaces and trims leading/trailing whitespace.
 */
function normalizeWhitespace(line: string): string {
	return line.replace(/\t/g, '  ').trim();
}

/**
 * Find subsequence with optional whitespace normalization for fuzzy matching.
 * Falls back to normalized matching if exact match fails.
 */
function findSubsequenceWithFuzzy(
	lines: string[],
	pattern: string[],
	startIndex: number,
	useFuzzy: boolean,
): number {
	// Try exact match first
	const exactMatch = findSubsequence(lines, pattern, startIndex);
	if (exactMatch !== -1) return exactMatch;

	// If fuzzy matching is enabled and exact match failed, try normalized matching
	if (useFuzzy && pattern.length > 0) {
		const normalizedLines = lines.map(normalizeWhitespace);
		const normalizedPattern = pattern.map(normalizeWhitespace);
		
		const start = Math.max(0, startIndex);
		for (let i = start; i <= lines.length - pattern.length; i++) {
			let matches = true;
			for (let j = 0; j < pattern.length; j++) {
				if (normalizedLines[i + j] !== normalizedPattern[j]) {
					matches = false;
					break;
				}
			}
			if (matches) return i;
		}
	}

	return -1;
}

function findSubsequence(
	lines: string[],
	pattern: string[],
	startIndex: number,
): number {
	if (pattern.length === 0) return -1;
	const start = Math.max(0, startIndex);
	for (let i = start; i <= lines.length - pattern.length; i++) {
		let matches = true;
		for (let j = 0; j < pattern.length; j++) {
			if (lines[i + j] !== pattern[j]) {
				matches = false;
				break;
			}
		}
		if (matches) return i;
	}
	return -1;
}

function parseDirectivePath(line: string, prefix: string): string {
	const filePath = line.slice(prefix.length).trim();
	if (!filePath) {
		throw new Error(`Missing file path for directive: ${line}`);
	}
	if (filePath.startsWith('/') || isAbsolute(filePath)) {
		throw new Error('Patch file paths must be relative to the project root.');
	}
	return filePath;
}

function parseHunkHeader(raw: string): PatchHunkHeader {
	const numericMatch = raw.match(
		/^@@\s*-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s*@@(?:\s*(.*))?$/,
	);
	if (numericMatch) {
		const [, oldStart, oldCount, newStart, newCount, context] = numericMatch;
		return {
			oldStart: Number.parseInt(oldStart, 10),
			oldLines: oldCount ? Number.parseInt(oldCount, 10) : undefined,
			newStart: Number.parseInt(newStart, 10),
			newLines: newCount ? Number.parseInt(newCount, 10) : undefined,
			context: context?.trim() || undefined,
		};
	}

	const context = raw.replace(/^@@/, '').trim();
	return context ? { context } : {};
}

function parseEnvelopedPatch(patch: string): ParsedPatchOperation[] {
	const normalized = patch.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const operations: ParsedPatchOperation[] = [];

	type Builder =
		| (PatchAddOperation & { kind: 'add' })
		| (PatchDeleteOperation & { kind: 'delete' })
		| (PatchUpdateOperation & {
				kind: 'update';
				currentHunk: PatchHunk | null;
		  });

	let builder: Builder | null = null;
	let insidePatch = false;
	let encounteredEnd = false;

	const flushBuilder = () => {
		if (!builder) return;
		if (builder.kind === 'update') {
			if (builder.currentHunk && builder.currentHunk.lines.length === 0) {
				builder.hunks.pop();
			}
			if (builder.hunks.length === 0) {
				throw new Error(
					`Update for ${builder.filePath} does not contain any diff hunks.`,
				);
			}
			operations.push({
				kind: 'update',
				filePath: builder.filePath,
				hunks: builder.hunks.map((hunk) => ({
					header: { ...hunk.header },
					lines: hunk.lines.map((line) => ({ ...line })),
				})),
			});
		} else if (builder.kind === 'add') {
			operations.push({
				kind: 'add',
				filePath: builder.filePath,
				lines: [...builder.lines],
			});
		} else {
			operations.push({ kind: 'delete', filePath: builder.filePath });
		}
		builder = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!insidePatch) {
			if (line.trim() === '') continue;
			if (line.startsWith(PATCH_BEGIN_MARKER)) {
				insidePatch = true;
				continue;
			}
			throw new Error(
				'Patch must start with "*** Begin Patch" and use the enveloped patch format.',
			);
		}

		if (line.startsWith(PATCH_BEGIN_MARKER)) {
			throw new Error('Nested "*** Begin Patch" markers are not supported.');
		}

		if (line.startsWith(PATCH_END_MARKER)) {
			flushBuilder();
			encounteredEnd = true;
			const remaining = lines.slice(i + 1).find((rest) => rest.trim() !== '');
			if (remaining) {
				throw new Error(
					'Unexpected content found after "*** End Patch" marker.',
				);
			}
			break;
		}

		if (line.startsWith(PATCH_ADD_PREFIX)) {
			flushBuilder();
			builder = {
				kind: 'add',
				filePath: parseDirectivePath(line, PATCH_ADD_PREFIX),
				lines: [],
			};
			continue;
		}

		if (line.startsWith(PATCH_UPDATE_PREFIX)) {
			flushBuilder();
			builder = {
				kind: 'update',
				filePath: parseDirectivePath(line, PATCH_UPDATE_PREFIX),
				hunks: [],
				currentHunk: null,
			};
			continue;
		}

		if (line.startsWith(PATCH_DELETE_PREFIX)) {
			flushBuilder();
			builder = {
				kind: 'delete',
				filePath: parseDirectivePath(line, PATCH_DELETE_PREFIX),
			};
			continue;
		}

		if (!builder) {
			if (line.trim() === '') {
				continue;
			}
			throw new Error(`Unexpected content in patch: "${line}"`);
		}

		if (builder.kind === 'add') {
			const content = line.startsWith('+') ? line.slice(1) : line;
			builder.lines.push(content);
			continue;
		}

		if (builder.kind === 'delete') {
			if (line.trim() !== '') {
				throw new Error(
					`Delete directive for ${builder.filePath} should not contain additional lines.`,
				);
			}
			continue;
		}

		if (line.startsWith('@@')) {
			const hunk: PatchHunk = { header: parseHunkHeader(line), lines: [] };
			builder.hunks.push(hunk);
			builder.currentHunk = hunk;
			continue;
		}

		if (!builder.currentHunk) {
			const fallbackHunk: PatchHunk = { header: {}, lines: [] };
			builder.hunks.push(fallbackHunk);
			builder.currentHunk = fallbackHunk;
		}

		const currentHunk = builder.currentHunk;
		const prefix = line[0];
		if (prefix === '+') {
			currentHunk.lines.push({ kind: 'add', content: line.slice(1) });
		} else if (prefix === '-') {
			currentHunk.lines.push({ kind: 'remove', content: line.slice(1) });
		} else if (prefix === ' ') {
			currentHunk.lines.push({ kind: 'context', content: line.slice(1) });
		} else {
			throw new Error(`Unrecognized patch line: "${line}"`);
		}
	}

	if (!encounteredEnd) {
		throw new Error('Missing "*** End Patch" marker.');
	}

	return operations;
}

function resolveProjectPath(projectRoot: string, filePath: string): string {
	const fullPath = resolve(projectRoot, filePath);
	const relativePath = relative(projectRoot, fullPath);
	if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
		throw new Error(`Patch path escapes project root: ${filePath}`);
	}
	return fullPath;
}

async function applyAddOperation(
	projectRoot: string,
	operation: PatchAddOperation,
): Promise<AppliedOperationRecord> {
	const targetPath = resolveProjectPath(projectRoot, operation.filePath);
	await mkdir(dirname(targetPath), { recursive: true });
	const linesForWrite = [...operation.lines];
	ensureTrailingNewline(linesForWrite);
	await writeFile(targetPath, joinLines(linesForWrite, '\n'), 'utf-8');

	const hunkLines: PatchHunkLine[] = operation.lines.map((line) => ({
		kind: 'add',
		content: line,
	}));

	return {
		kind: 'add',
		filePath: operation.filePath,
		operation,
		stats: {
			additions: hunkLines.length,
			deletions: 0,
		},
		hunks: [
			{
				header: {},
				lines: hunkLines,
				oldStart: 0,
				oldLines: 0,
				newStart: 1,
				newLines: hunkLines.length,
				additions: hunkLines.length,
				deletions: 0,
			},
		],
	};
}

async function applyDeleteOperation(
	projectRoot: string,
	operation: PatchDeleteOperation,
): Promise<AppliedOperationRecord> {
	const targetPath = resolveProjectPath(projectRoot, operation.filePath);
	let existingContent = '';
	try {
		existingContent = await readFile(targetPath, 'utf-8');
	} catch (error) {
		if (isErrnoException(error) && error.code === 'ENOENT') {
			throw new Error(`File not found for deletion: ${operation.filePath}`);
		}
		throw error;
	}

	const { lines } = splitLines(existingContent);
	await unlink(targetPath);

	const hunkLines: PatchHunkLine[] = lines.map((line) => ({
		kind: 'remove',
		content: line,
	}));

	return {
		kind: 'delete',
		filePath: operation.filePath,
		operation,
		stats: {
			additions: 0,
			deletions: hunkLines.length,
		},
		hunks: [
			{
				header: {},
				lines: hunkLines,
				oldStart: 1,
				oldLines: hunkLines.length,
				newStart: 0,
				newLines: 0,
				additions: 0,
				deletions: hunkLines.length,
			},
		],
	};
}

function applyHunksToLines(
	originalLines: string[],
	hunks: PatchHunk[],
	filePath: string,
	useFuzzy: boolean = false,
): { lines: string[]; applied: AppliedHunkResult[] } {
	const lines = [...originalLines];
	let searchIndex = 0;
	let lineOffset = 0;
	const applied: AppliedHunkResult[] = [];

	for (const hunk of hunks) {
		const expected: string[] = [];
		const replacement: string[] = [];
		let additions = 0;
		let deletions = 0;

		for (const line of hunk.lines) {
			if (line.kind !== 'add') {
				expected.push(line.content);
			}
			if (line.kind !== 'remove') {
				replacement.push(line.content);
			}
			if (line.kind === 'add') additions += 1;
			if (line.kind === 'remove') deletions += 1;
		}

		const hasExpected = expected.length > 0;
		const hint =
			typeof hunk.header.oldStart === 'number'
				? Math.max(0, hunk.header.oldStart - 1 + lineOffset)
				: searchIndex;

		let matchIndex = hasExpected
			? findSubsequenceWithFuzzy(lines, expected, Math.max(0, hint - 3), useFuzzy)
			: -1;

		if (hasExpected && matchIndex === -1) {
			matchIndex = findSubsequenceWithFuzzy(lines, expected, 0, useFuzzy);
		}

		if (matchIndex === -1 && hasExpected && hunk.header.context) {
			const contextIndex = findSubsequence(lines, [hunk.header.context], 0);
			if (contextIndex !== -1) {
				const positionInExpected = expected.indexOf(hunk.header.context);
				matchIndex =
					positionInExpected >= 0
						? Math.max(0, contextIndex - positionInExpected)
						: contextIndex;
			}
		}

		if (!hasExpected) {
			matchIndex = computeInsertionIndex(lines, hint, hunk.header);
		}

		if (matchIndex === -1) {
			const contextInfo = hunk.header.context
				? ` near context '${hunk.header.context}'`
				: '';
			
			// Provide helpful error with nearby context
			const nearbyStart = Math.max(0, hint - 2);
			const nearbyEnd = Math.min(lines.length, hint + 5);
			const nearbyLines = lines.slice(nearbyStart, nearbyEnd);
			const lineNumberInfo = nearbyStart > 0 ? ` (around line ${nearbyStart + 1})` : '';
			
			let errorMsg = `Failed to apply patch hunk in ${filePath}${contextInfo}.\n`;
			errorMsg += `Expected to find:\n${expected.map(l => `  ${l}`).join('\n')}\n`;
			errorMsg += `Nearby context${lineNumberInfo}:\n${nearbyLines.map((l, idx) => `  ${nearbyStart + idx + 1}: ${l}`).join('\n')}\n`;
			errorMsg += `Hint: Check for whitespace differences (tabs vs spaces). Try enabling fuzzyMatch option.`;
			
			throw new Error(
				errorMsg,
			);
		}

		const deleteCount = hasExpected ? expected.length : 0;
		const originalIndex = matchIndex - lineOffset;
		const normalizedOriginalIndex = Math.min(
			Math.max(0, originalIndex),
			originalLines.length,
		);
		const oldStart = normalizedOriginalIndex + 1;
		const newStart = matchIndex + 1;

		lines.splice(matchIndex, deleteCount, ...replacement);
		searchIndex = matchIndex + replacement.length;
		lineOffset += replacement.length - deleteCount;

		applied.push({
			header: { ...hunk.header },
			lines: hunk.lines.map((line) => ({ ...line })),
			oldStart,
			oldLines: deleteCount,
			newStart,
			newLines: replacement.length,
			additions,
			deletions,
		});
	}

	return { lines, applied };
}

function computeInsertionIndex(
	lines: string[],
	hint: number,
	header: PatchHunkHeader,
): number {
	if (header.context) {
		const contextIndex = findSubsequence(lines, [header.context], 0);
		if (contextIndex !== -1) {
			return contextIndex + 1;
		}
	}

	if (typeof header.oldStart === 'number') {
		const zeroBased = Math.max(0, header.oldStart - 1);
		return Math.min(lines.length, zeroBased);
	}

	if (typeof header.newStart === 'number') {
		const zeroBased = Math.max(0, header.newStart - 1);
		return Math.min(lines.length, zeroBased);
	}

	return Math.min(lines.length, Math.max(0, hint));
}

async function applyUpdateOperation(
	projectRoot: string,
	operation: PatchUpdateOperation,
	useFuzzy: boolean = false,
): Promise<AppliedOperationRecord> {
	const targetPath = resolveProjectPath(projectRoot, operation.filePath);
	let originalContent: string;
	try {
		originalContent = await readFile(targetPath, 'utf-8');
	} catch (error) {
		if (isErrnoException(error) && error.code === 'ENOENT') {
			throw new Error(`File not found: ${operation.filePath}`);
		}
		throw error;
	}

	const { lines: originalLines, newline } = splitLines(originalContent);
	const { lines: updatedLines, applied } = applyHunksToLines(
		originalLines,
		operation.hunks,
		operation.filePath,
		useFuzzy,
	);
	ensureTrailingNewline(updatedLines);
	await writeFile(targetPath, joinLines(updatedLines, newline), 'utf-8');

	const stats = applied.reduce<PatchStats>(
		(acc, hunk) => ({
			additions: acc.additions + hunk.additions,
			deletions: acc.deletions + hunk.deletions,
		}),
		{ additions: 0, deletions: 0 },
	);

	return {
		kind: 'update',
		filePath: operation.filePath,
		operation,
		stats,
		hunks: applied,
	};
}

function summarizeOperations(operations: AppliedOperationRecord[]) {
	const summary = operations.reduce(
		(acc, op) => ({
			files: acc.files + 1,
			additions: acc.additions + op.stats.additions,
			deletions: acc.deletions + op.stats.deletions,
		}),
		{ files: 0, additions: 0, deletions: 0 },
	);
	return {
		files: Math.max(summary.files, operations.length > 0 ? 1 : 0),
		additions: summary.additions,
		deletions: summary.deletions,
	};
}

function formatRange(start: number, count: number) {
	const normalizedStart = Math.max(0, start);
	if (count === 0) return `${normalizedStart},0`;
	if (count === 1) return `${normalizedStart}`;
	return `${normalizedStart},${count}`;
}

function formatHunkHeader(applied: AppliedHunkResult) {
	const oldRange = formatRange(applied.oldStart, applied.oldLines);
	const newRange = formatRange(applied.newStart, applied.newLines);
	const context = applied.header.context?.trim();
	return context
		? `@@ -${oldRange} +${newRange} @@ ${context}`
		: `@@ -${oldRange} +${newRange} @@`;
}

function serializePatchLine(line: PatchHunkLine): string {
	switch (line.kind) {
		case 'add':
			return `+${line.content}`;
		case 'remove':
			return `-${line.content}`;
		default:
			return ` ${line.content}`;
	}
}

function formatNormalizedPatch(operations: AppliedOperationRecord[]): string {
	const lines: string[] = [PATCH_BEGIN_MARKER];

	for (const op of operations) {
		switch (op.kind) {
			case 'add': {
				lines.push(`${PATCH_ADD_PREFIX} ${op.filePath}`);
				for (const hunk of op.hunks) {
					lines.push(formatHunkHeader(hunk));
					for (const line of hunk.lines) {
						lines.push(serializePatchLine(line));
					}
				}
				break;
			}
			case 'delete': {
				lines.push(`${PATCH_DELETE_PREFIX} ${op.filePath}`);
				for (const hunk of op.hunks) {
					lines.push(formatHunkHeader(hunk));
					for (const line of hunk.lines) {
						lines.push(serializePatchLine(line));
					}
				}
				break;
			}
			case 'update': {
				lines.push(`${PATCH_UPDATE_PREFIX} ${op.filePath}`);
				const updateOp = op.operation as PatchUpdateOperation;
				for (let i = 0; i < updateOp.hunks.length; i++) {
					const originalHunk = updateOp.hunks[i];
					const appliedHunk = op.hunks[i];
					const header: AppliedHunkResult = {
						...appliedHunk,
						header: {
							...appliedHunk.header,
							context: originalHunk.header.context,
						},
					};
					lines.push(formatHunkHeader(header));
					for (const line of originalHunk.lines) {
						lines.push(serializePatchLine(line));
					}
				}
				break;
			}
		}
	}

	lines.push(PATCH_END_MARKER);
	return lines.join('\n');
}

async function applyEnvelopedPatch(projectRoot: string, patch: string, useFuzzy: boolean = false) {
	const operations = parseEnvelopedPatch(patch);
	const applied: AppliedOperationRecord[] = [];

	for (const operation of operations) {
		if (operation.kind === 'add') {
			applied.push(await applyAddOperation(projectRoot, operation));
		} else if (operation.kind === 'delete') {
			applied.push(await applyDeleteOperation(projectRoot, operation));
		} else {
			applied.push(await applyUpdateOperation(projectRoot, operation, useFuzzy));
		}
	}

	return {
		operations: applied,
		normalizedPatch: formatNormalizedPatch(applied),
	};
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
		async execute({ patch, fuzzyMatch }: { patch: string; allowRejects?: boolean; fuzzyMatch?: boolean }): Promise<
			ToolResponse<{
				output: string;
				changes: unknown[];
				artifact: unknown;
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

			if (
				!patch.includes(PATCH_BEGIN_MARKER) ||
				!patch.includes(PATCH_END_MARKER)
			) {
				return createToolError(
					'Only enveloped patch format is supported. Patch must start with "*** Begin Patch" and contain "*** Add File:", "*** Update File:", or "*** Delete File:" directives.',
					'validation',
					{
						parameter: 'patch',
						suggestion: 'Use enveloped patch format starting with *** Begin Patch',
					},
				);
			}

			try {
				const { operations, normalizedPatch } = await applyEnvelopedPatch(
					projectRoot,
					patch,
					fuzzyMatch ?? true,
				);
				const summary = summarizeOperations(operations);
				const changes = operations.map((operation) => ({
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

				return {
					ok: true,
					output: 'Applied enveloped patch',
					changes,
					artifact: {
						kind: 'file_diff',
						patch: normalizedPatch,
						summary,
					},
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				return createToolError(
					`Failed to apply patch: ${errorMessage}`,
					'execution',
					{
						suggestion: 'Check that the patch format is correct and target files exist',
					},
				);
			}
		},
	});
	return { name: 'apply_patch', tool: applyPatch };
}
