import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
	NORMALIZATION_LEVELS,
	normalizeWhitespace,
} from './normalize.ts';
import {
	PATCH_ADD_PREFIX,
	PATCH_DELETE_PREFIX,
	PATCH_UPDATE_PREFIX,
	PATCH_BEGIN_MARKER,
	PATCH_END_MARKER,
} from './constants.ts';
import {
	AppliedPatchHunk,
	AppliedPatchOperation,
	PatchAddOperation,
	PatchApplicationResult,
	PatchDeleteOperation,
	PatchHunk,
	PatchHunkLine,
	PatchOperation,
	PatchSummary,
	PatchUpdateOperation,
	RejectedPatch,
} from './types.ts';
import { ensureTrailingNewline, joinLines, splitLines } from './text.ts';

export function resolveProjectPath(projectRoot: string, filePath: string): string {
	const fullPath = resolve(projectRoot, filePath);
	const relativePath = relative(projectRoot, fullPath);
	if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
		throw new Error(`Patch path escapes project root: ${filePath}`);
	}
	return fullPath;
}

function makeAppliedRecord(
	kind: AppliedPatchOperation['kind'],
	filePath: string,
	hunks: AppliedPatchHunk[],
): AppliedPatchOperation {
	const stats = hunks.reduce(
		(acc, hunk) => ({
			additions: acc.additions + hunk.additions,
			deletions: acc.deletions + hunk.deletions,
		}),
		{ additions: 0, deletions: 0 },
	);
	return {
		kind,
		filePath,
		stats,
		hunks,
	};
}

function makeSummary(operations: AppliedPatchOperation[]): PatchSummary {
	return operations.reduce<PatchSummary>(
		(acc, op) => ({
			files: acc.files + 1,
			additions: acc.additions + op.stats.additions,
			deletions: acc.deletions + op.stats.deletions,
		}),
		{ files: 0, additions: 0, deletions: 0 },
	);
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

function formatRange(start: number, count: number) {
	const normalizedStart = Math.max(0, start);
	if (count === 0) return `${normalizedStart},0`;
	if (count === 1) return `${normalizedStart}`;
	return `${normalizedStart},${count}`;
}

function formatHunkHeader(hunk: AppliedPatchHunk) {
	const oldRange = formatRange(hunk.oldStart, hunk.oldLines);
	const newRange = formatRange(hunk.newStart, hunk.newLines);
	const context = hunk.header.context?.trim();
	return context
		? `@@ -${oldRange} +${newRange} @@ ${context}`
		: `@@ -${oldRange} +${newRange} @@`;
}

function formatNormalizedPatch(operations: AppliedPatchOperation[]): string {
	const lines: string[] = [PATCH_BEGIN_MARKER];
	for (const op of operations) {
		switch (op.kind) {
			case 'add':
				lines.push(`${PATCH_ADD_PREFIX} ${op.filePath}`);
				break;
			case 'delete':
				lines.push(`${PATCH_DELETE_PREFIX} ${op.filePath}`);
				break;
			case 'update':
				lines.push(`${PATCH_UPDATE_PREFIX} ${op.filePath}`);
				break;
		}

		if (op.kind === 'add' || op.kind === 'delete') {
			for (const hunk of op.hunks) {
				lines.push(formatHunkHeader(hunk));
				for (const line of hunk.lines) {
					lines.push(serializePatchLine(line));
				}
			}
			continue;
		}

		for (const hunk of op.hunks) {
			lines.push(formatHunkHeader(hunk));
			for (const line of hunk.lines) {
				lines.push(serializePatchLine(line));
			}
		}
	}
	lines.push(PATCH_END_MARKER);
	return lines.join('\n');
}

function findLineIndex(
	lines: string[],
	pattern: string,
	start: number,
	useFuzzy: boolean,
): number {
	for (let i = Math.max(0, start); i < lines.length; i++) {
		if (lines[i] === pattern) return i;
		if (!useFuzzy) continue;
		for (const level of NORMALIZATION_LEVELS.slice(1)) {
			if (
				normalizeWhitespace(lines[i], level) ===
				normalizeWhitespace(pattern, level)
			) {
				return i;
			}
		}
	}
	return -1;
}

function findSubsequence(
	lines: string[],
	pattern: string[],
	startIndex: number,
	useFuzzy: boolean,
): number {
	if (pattern.length === 0) return -1;
	const start = Math.max(0, startIndex);
	for (let i = start; i <= lines.length - pattern.length; i++) {
		let matches = true;
		for (let j = 0; j < pattern.length; j++) {
			const line = lines[i + j];
			const target = pattern[j];
			if (line === target) continue;
			if (!useFuzzy) {
				matches = false;
				break;
			}
			let matched = false;
			for (const level of NORMALIZATION_LEVELS.slice(1)) {
				if (
					normalizeWhitespace(line, level) ===
					normalizeWhitespace(target, level)
				) {
					matched = true;
					break;
				}
			}
			if (!matched) {
				matches = false;
				break;
			}
		}
		if (matches) return i;
	}
	return -1;
}

function computeInsertionIndex(
	lines: string[],
	header: PatchHunk['header'],
	hint: number,
): number {
	if (header.context) {
		const contextIndex = findLineIndex(lines, header.context, 0, true);
		if (contextIndex !== -1) return contextIndex + 1;
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

function lineExists(lines: string[], target: string, useFuzzy: boolean): boolean {
	return findLineIndex(lines, target, 0, useFuzzy) !== -1;
}

function isHunkAlreadyApplied(
	lines: string[],
	hunk: PatchHunk,
	useFuzzy: boolean,
): boolean {
	const replacement = hunk.lines
		.filter((line) => line.kind !== 'remove')
		.map((line) => line.content);

	if (replacement.length > 0) {
		return findSubsequence(lines, replacement, 0, useFuzzy) !== -1;
	}

	const removals = hunk.lines.filter((line) => line.kind === 'remove');
	const additions = hunk.lines
		.filter((line) => line.kind === 'add')
		.map((line) => line.content);
	const contextLines = hunk.lines
		.filter((line) => line.kind === 'context')
		.map((line) => line.content);
	if (removals.length === 0) return false;
	return removals.every(
		(line) => !lineExists(lines, line.content, useFuzzy),
	);
}

function applyHunkToLines(
	lines: string[],
	originalLines: string[],
	hunk: PatchHunk,
	hint: number,
	useFuzzy: boolean,
): AppliedPatchHunk | null {
	const expected = hunk.lines
		.filter((line) => line.kind !== 'add')
		.map((line) => line.content);
	const replacement = hunk.lines
		.filter((line) => line.kind !== 'remove')
		.map((line) => line.content);

	const removals = hunk.lines.filter((line) => line.kind === 'remove');

	const hasExpected = expected.length > 0;
	const initialHint =
		typeof hunk.header.oldStart === 'number'
			? Math.max(0, hunk.header.oldStart - 1)
			: hint;

	let matchIndex = hasExpected
		? findSubsequence(lines, expected, Math.max(0, initialHint - 3), useFuzzy)
		: -1;

	if (hasExpected && matchIndex === -1) {
		matchIndex = findSubsequence(lines, expected, 0, useFuzzy);
	}

	if (matchIndex === -1 && removals.length > 0) {
		const expectedWithoutMissingRemovals = expected.filter((line) =>
			lineExists(lines, line, useFuzzy),
		);
		if (expectedWithoutMissingRemovals.length > 0) {
			matchIndex = findSubsequence(
				lines,
				expectedWithoutMissingRemovals,
				Math.max(0, initialHint - 3),
				useFuzzy,
			);
			if (matchIndex === -1) {
				matchIndex = findSubsequence(
					lines,
					expectedWithoutMissingRemovals,
					0,
					useFuzzy,
				);
			}
		}
	}

	if (matchIndex === -1 && isHunkAlreadyApplied(lines, hunk, useFuzzy)) {
		const skipStart =
			initialHint >= 0 && initialHint < lines.length ? initialHint + 1 : 1;
		return {
			header: { ...hunk.header },
			lines: hunk.lines.map((line) => ({ ...line })),
			oldStart: skipStart,
			oldLines: 0,
			newStart: skipStart,
			newLines: replacement.length,
			additions: hunk.lines.filter((l) => l.kind === 'add').length,
			deletions: hunk.lines.filter((l) => l.kind === 'remove').length,
		};
	}

	if (matchIndex === -1 && !hasExpected) {
		matchIndex = computeInsertionIndex(lines, hunk.header, initialHint);
	}

	if (matchIndex === -1) {
		const contextInfo = hunk.header.context
			? ` near context '${hunk.header.context}'`
			: '';

		if (additions.length > 0) {
			const anchorContext =
				contextLines.length > 0
					? contextLines[contextLines.length - 1]
					: undefined;
			const anchorIndex =
				anchorContext !== undefined
					? findLineIndex(lines, anchorContext, 0, useFuzzy)
					: -1;

			let insertionIndex =
				anchorIndex !== -1
					? anchorIndex + 1
					: computeInsertionIndex(lines, hunk.header, initialHint);

			if (
				findSubsequence(
					lines,
					additions,
					Math.max(0, insertionIndex - additions.length),
					useFuzzy,
				) !== -1
			) {
				const skipStart =
					insertionIndex >= 0 && insertionIndex < lines.length
						? insertionIndex + 1
						: lines.length + 1;
				return {
					header: { ...hunk.header },
					lines: hunk.lines.map((line) => ({ ...line })),
					oldStart: skipStart,
					oldLines: 0,
					newStart: skipStart,
					newLines: additions.length,
					additions: additions.length,
					deletions: 0,
				};
			}

			const anchorInOriginal =
				anchorContext !== undefined
					? findLineIndex(originalLines, anchorContext, 0, useFuzzy)
					: -1;
			const oldStart =
				anchorInOriginal !== -1
					? anchorInOriginal + 1
					: Math.min(originalLines.length + 1, insertionIndex + 1);

			lines.splice(insertionIndex, 0, ...additions);

			return {
				header: { ...hunk.header },
				lines: hunk.lines.map((line) => ({ ...line })),
				oldStart,
				oldLines: 0,
				newStart: insertionIndex + 1,
				newLines: additions.length,
				additions: additions.length,
				deletions: 0,
			};
		}

		let errorMsg = `Failed to apply patch hunk${contextInfo}.`;
		if (expected.length > 0) {
			errorMsg += `\nExpected to find:\n${expected
				.map((l) => `  ${l}`)
				.join('\n')}`;
		}
		if (removals.length > 0) {
			const missing = removals
				.filter((line) => !lineExists(lines, line.content, useFuzzy))
				.map((line) => line.content);
			if (missing.length === removals.length) {
				errorMsg +=
					'\nAll removal lines already absent; consider reading the file again to capture current state.';
			}
		}
		throw new Error(errorMsg);
	}

	const deleteCount = hasExpected ? expected.length : 0;
	const originalIndex = matchIndex;
	const oldStart = Math.min(
		originalLines.length,
		Math.max(0, originalIndex) + 1,
	);
	const newStart = matchIndex + 1;

	lines.splice(matchIndex, deleteCount, ...replacement);

	return {
		header: { ...hunk.header },
		lines: hunk.lines.map((line) => ({ ...line })),
		oldStart,
		oldLines: deleteCount,
		newStart,
		newLines: replacement.length,
		additions: hunk.lines.filter((l) => l.kind === 'add').length,
		deletions: hunk.lines.filter((l) => l.kind === 'remove').length,
	};
}

async function applyAddOperation(
	projectRoot: string,
	operation: PatchAddOperation,
): Promise<AppliedPatchOperation> {
	const target = resolveProjectPath(projectRoot, operation.filePath);
	await mkdir(dirname(target), { recursive: true });
	const lines = [...operation.lines];
	ensureTrailingNewline(lines);
	await writeFile(target, joinLines(lines, '\n'), 'utf-8');

	const appliedHunk: AppliedPatchHunk = {
		header: {},
		lines: operation.lines.map((line) => ({ kind: 'add', content: line })),
		oldStart: 0,
		oldLines: 0,
		newStart: 1,
		newLines: lines.length,
		additions: lines.length,
		deletions: 0,
	};

	return makeAppliedRecord('add', operation.filePath, [appliedHunk]);
}

async function applyDeleteOperation(
	projectRoot: string,
	operation: PatchDeleteOperation,
): Promise<AppliedPatchOperation> {
	const target = resolveProjectPath(projectRoot, operation.filePath);
	let existing = '';
	try {
		existing = await readFile(target, 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(`File not found for deletion: ${operation.filePath}`);
		}
		throw error;
	}

	const { lines } = splitLines(existing);
	await unlink(target);

	const appliedHunk: AppliedPatchHunk = {
		header: {},
		lines: lines.map((line) => ({ kind: 'remove', content: line })),
		oldStart: 1,
		oldLines: lines.length,
		newStart: 0,
		newLines: 0,
		additions: 0,
		deletions: lines.length,
	};

	return makeAppliedRecord('delete', operation.filePath, [appliedHunk]);
}

async function applyUpdateOperation(
	projectRoot: string,
	operation: PatchUpdateOperation,
	useFuzzy: boolean,
): Promise<AppliedPatchOperation> {
	const target = resolveProjectPath(projectRoot, operation.filePath);
	let original: string;
	try {
		original = await readFile(target, 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(`File not found: ${operation.filePath}`);
		}
		throw error;
	}

	const { lines: originalLines, newline } = splitLines(original);
	const workingLines = [...originalLines];
	const appliedHunks: AppliedPatchHunk[] = [];
	let hint = 0;

	for (const hunk of operation.hunks) {
		const applied = applyHunkToLines(
			workingLines,
			originalLines,
			hunk,
			hint,
			useFuzzy,
		);
		if (!applied) continue;
		appliedHunks.push(applied);
		hint = applied.newStart + applied.newLines - 1;
	}

	ensureTrailingNewline(workingLines);
	await writeFile(target, joinLines(workingLines, newline), 'utf-8');

	return makeAppliedRecord('update', operation.filePath, appliedHunks);
}

export async function applyPatchOperations(
	projectRoot: string,
	operations: PatchOperation[],
	options: { useFuzzy: boolean; allowRejects: boolean },
): Promise<PatchApplicationResult> {
	const applied: AppliedPatchOperation[] = [];
	const rejected: RejectedPatch[] = [];

	for (const operation of operations) {
		try {
			if (operation.kind === 'add') {
				applied.push(
					await applyAddOperation(projectRoot, operation),
				);
			} else if (operation.kind === 'delete') {
				applied.push(
					await applyDeleteOperation(projectRoot, operation),
				);
			} else {
				applied.push(
					await applyUpdateOperation(projectRoot, operation, options.useFuzzy),
				);
			}
		} catch (error) {
			if (options.allowRejects) {
				rejected.push({
					kind: operation.kind,
					filePath: operation.filePath,
					reason: error instanceof Error ? error.message : String(error),
					operation,
				});
				continue;
			}
			throw error;
		}
	}

	const summary = makeSummary(applied);

	return {
		operations: applied,
		summary,
		normalizedPatch: formatNormalizedPatch(applied),
		rejected,
	};
}
