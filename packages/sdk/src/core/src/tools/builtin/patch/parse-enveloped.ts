import {
	PATCH_ADD_PREFIX,
	PATCH_BEGIN_MARKER,
	PATCH_DELETE_PREFIX,
	PATCH_END_MARKER,
	PATCH_UPDATE_PREFIX,
} from './constants.ts';
import type {
	PatchAddOperation,
	PatchDeleteOperation,
	PatchHunk,
	PatchHunkLine,
	PatchOperation,
	PatchUpdateOperation,
} from './types.ts';

function parseDirectivePath(line: string, prefix: string): string {
	const filePath = line.slice(prefix.length).trim();
	if (!filePath) {
		throw new Error(`Missing file path for directive: ${line}`);
	}
	if (filePath.startsWith('/') || filePath.includes('..')) {
		throw new Error('Patch file paths must be relative to the project root.');
	}
	return filePath;
}

function parseHunkHeader(raw: string) {
	const match = raw.match(
		/^@@\s*-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s*@@(?:\s*(.*))?$/,
	);
	if (match) {
		const [, oldStart, oldCount, newStart, newCount, context] = match;
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

export function parseEnvelopedPatch(patch: string): PatchOperation[] {
	const normalized = patch.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const operations: PatchOperation[] = [];

	type Builder =
		| (PatchAddOperation & { kind: 'add' })
		| (PatchDeleteOperation & { kind: 'delete' })
		| (PatchUpdateOperation & {
				kind: 'update';
				currentHunk: PatchHunk | null;
		  });

	let builder: Builder | null = null;
	let inside = false;
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

		if (!inside) {
			if (line.trim() === '') continue;
			if (line.startsWith(PATCH_BEGIN_MARKER)) {
				inside = true;
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
			if (line.trim() === '') continue;
			throw new Error(`Unexpected content in patch: "${line}"`);
		}

		if (builder.kind === 'add') {
			builder.lines.push(line.startsWith('+') ? line.slice(1) : line);
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
			const fallback: PatchHunk = { header: {}, lines: [] };
			builder.hunks.push(fallback);
			builder.currentHunk = fallback;
		}

		const hunk = builder.currentHunk;
		const prefix = line[0];
		const createLine = (kind: PatchHunkLine['kind'], content: string) => ({
			kind,
			content,
		});

		if (prefix === '+') {
			hunk.lines.push(createLine('add', line.slice(1)));
		} else if (prefix === '-') {
			hunk.lines.push(createLine('remove', line.slice(1)));
		} else if (prefix === ' ') {
			hunk.lines.push(createLine('context', line.slice(1)));
		} else {
			hunk.lines.push(createLine('context', line));
		}
	}

	if (!encounteredEnd) {
		throw new Error('Missing "*** End Patch" marker.');
	}

	return operations;
}
