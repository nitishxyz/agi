import type {
	ToolCallContent,
	ToolCallLocation,
	ToolKind,
} from '@agentclientprotocol/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';

const WRITE_TOOLS = ['write', 'edit', 'multiedit', 'copy_into', 'apply_patch'];

export function buildToolResultContent(
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown> | string | undefined,
	cwd?: string,
): ToolCallContent[] {
	if (result === undefined || result === null) return [];

	if (isWriteTool(name)) {
		return buildDiffContent(name, args, result, cwd);
	}

	if (isShellTool(name)) {
		return buildBashContent(result);
	}

	if (name === 'read') {
		return buildReadContent(args, result);
	}

	let text: string;
	if (typeof result === 'string') {
		text = result;
	} else {
		try {
			text = JSON.stringify(result, null, 2);
		} catch {
			text = String(result);
		}
	}

	if (!text || text.length === 0) return [];

	return [
		{
			type: 'content',
			content: { type: 'text', text: truncate(text, 5000) },
		},
	];
}

export function buildDiffContent(
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown> | string | undefined,
	cwd?: string,
): ToolCallContent[] {
	const content: ToolCallContent[] = [];

	if (typeof result === 'object' && result !== null) {
		const artifact = result.artifact as Record<string, unknown> | undefined;
		const patch = artifact?.patch as string | undefined;

		if (artifact?.kind === 'file_diff' && patch) {
			const diffs = buildFileDiffContents(name, args, result, patch, cwd);
			if (diffs.length > 0) {
				content.push(...diffs);
				return content;
			}
		}

		const ok = result.ok;
		const output = result.output as string | undefined;
		if (ok !== undefined && output) {
			content.push({
				type: 'content',
				content: { type: 'text', text: truncate(output, 3000) },
			});
			return content;
		}
	}

	let text: string;
	if (typeof result === 'string') {
		text = result;
	} else {
		try {
			text = JSON.stringify(result, null, 2);
		} catch {
			text = String(result);
		}
	}
	if (text) {
		content.push({
			type: 'content',
			content: { type: 'text', text: truncate(text, 3000) },
		});
	}

	return content;
}

function buildFileDiffContents(
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown>,
	patch: string,
	cwd?: string,
): ToolCallContent[] {
	if (!cwd) return [];

	const fileChanges = getFileChanges(name, args, result, patch);
	const contents: ToolCallContent[] = [];

	for (const change of fileChanges) {
		const absPath = path.isAbsolute(change.filePath)
			? change.filePath
			: path.join(cwd, change.filePath);
		const newText =
			change.kind === 'delete' ? '' : readTextFileIfExists(absPath);
		if (newText === undefined) continue;

		const oldText =
			change.kind === 'add'
				? null
				: reversePatchForFile(patch, change.filePath, newText);

		contents.push({
			type: 'diff',
			path: absPath,
			newText,
			oldText,
		} as ToolCallContent);
	}

	return contents;
}

function getFileChanges(
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown>,
	patch: string,
): Array<{ filePath: string; kind: 'add' | 'update' | 'delete' }> {
	const changes = result.changes as Array<Record<string, unknown>> | undefined;
	if (Array.isArray(changes)) {
		return changes.flatMap((change) => {
			if (typeof change.filePath !== 'string') return [];
			return [
				{
					filePath: change.filePath,
					kind: parseChangeKind(change.kind),
				},
			];
		});
	}

	const filePath = extractFilePath(name, args, patch);
	if (!filePath) return [];
	return [
		{
			filePath,
			kind: patch.includes(`*** Add File: ${filePath}`) ? 'add' : 'update',
		},
	];
}

function parseChangeKind(value: unknown): 'add' | 'update' | 'delete' {
	if (value === 'add' || value === 'delete') return value;
	return 'update';
}

function readTextFileIfExists(filePath: string): string | undefined {
	try {
		return fs.readFileSync(filePath, 'utf-8');
	} catch {
		return undefined;
	}
}

function reversePatchForFile(
	patch: string,
	filePath: string,
	newText: string,
): string | null {
	const hunks = extractHunksForFile(patch, filePath);
	if (hunks.length === 0) return null;

	const oldLines = splitLines(newText);
	for (const hunk of hunks.reverse()) {
		const index = Math.max(0, hunk.newStart - 1);
		oldLines.splice(index, hunk.newLines.length, ...hunk.oldLines);
	}
	return oldLines.join('\n');
}

function extractHunksForFile(
	patch: string,
	filePath: string,
): Array<{ newStart: number; newLines: string[]; oldLines: string[] }> {
	const normalizedPath = normalizePatchPath(filePath);
	const hunks: Array<{
		newStart: number;
		newLines: string[];
		oldLines: string[];
	}> = [];
	let inTargetFile = false;
	let currentHunk:
		| { newStart: number; newLines: string[]; oldLines: string[] }
		| undefined;

	for (const line of patch.split('\n')) {
		const directivePath = parsePatchFileDirective(line);
		if (directivePath) {
			inTargetFile = normalizePatchPath(directivePath) === normalizedPath;
			currentHunk = undefined;
			continue;
		}

		const unifiedPath = parseUnifiedFileHeader(line);
		if (unifiedPath) {
			inTargetFile = normalizePatchPath(unifiedPath) === normalizedPath;
			currentHunk = undefined;
			continue;
		}

		if (!inTargetFile) continue;

		const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunkMatch) {
			currentHunk = {
				newStart: Number(hunkMatch[2]),
				newLines: [],
				oldLines: [],
			};
			hunks.push(currentHunk);
			continue;
		}

		if (!currentHunk) continue;
		if (line.startsWith('+++ ') || line.startsWith('--- ')) continue;
		if (line.startsWith('*** ')) {
			currentHunk = undefined;
			continue;
		}

		const prefix = line[0];
		const value = line.slice(1);
		if (prefix === ' ') {
			currentHunk.oldLines.push(value);
			currentHunk.newLines.push(value);
		} else if (prefix === '-') {
			currentHunk.oldLines.push(value);
		} else if (prefix === '+') {
			currentHunk.newLines.push(value);
		}
	}

	return hunks;
}

function parsePatchFileDirective(line: string): string | undefined {
	const match = line.match(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/);
	return match?.[1]?.trim();
}

function parseUnifiedFileHeader(line: string): string | undefined {
	const match = line.match(/^(?:---|\+\+\+) (?:[ab]\/)?(.+)$/);
	const filePath = match?.[1]?.trim();
	if (!filePath || filePath === '/dev/null') return undefined;
	return filePath;
}

function normalizePatchPath(filePath: string): string {
	return filePath.replace(/\\/g, '/').replace(/^[ab]\//, '');
}

function splitLines(text: string): string[] {
	return text.length > 0 ? text.split('\n') : [];
}

export function buildBashContent(
	result: Record<string, unknown> | string | undefined,
): ToolCallContent[] {
	if (typeof result === 'object' && result !== null) {
		const stdout = result.stdout as string | undefined;
		const stderr = result.stderr as string | undefined;
		const exitCode = result.exitCode as number | undefined;

		const parts: string[] = [];
		if (stdout) parts.push(stdout);
		if (stderr) parts.push(`stderr: ${stderr}`);
		if (exitCode !== undefined && exitCode !== 0) {
			parts.push(`exit code: ${exitCode}`);
		}

		const text = parts.join('\n');
		if (text) {
			return [
				{
					type: 'content',
					content: { type: 'text', text: truncate(text, 5000) },
				},
			];
		}
	}

	return [];
}

export function buildReadContent(
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown> | string | undefined,
): ToolCallContent[] {
	if (typeof result === 'object' && result !== null) {
		const fileContent = (result as Record<string, unknown>).content as
			| string
			| undefined;
		const filePath = (result as Record<string, unknown>).path as
			| string
			| undefined;
		const _totalLines = (result as Record<string, unknown>).totalLines as
			| number
			| undefined;

		if (fileContent) {
			const _displayPath = filePath || (args?.path as string) || 'file';
			return [
				{
					type: 'content',
					content: {
						type: 'text',
						text: truncate(fileContent, 5000),
					},
				},
			];
		}
	}

	return [];
}

export function getWrittenFilePaths(
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown> | string | undefined,
): string[] {
	const paths: string[] = [];

	if (args?.path && typeof args.path === 'string') {
		paths.push(args.path);
	} else if (args?.targetPath && typeof args.targetPath === 'string') {
		paths.push(args.targetPath);
	} else if (args?.filePath && typeof args.filePath === 'string') {
		paths.push(args.filePath);
	}

	if (name === 'apply_patch' && typeof args?.patch === 'string') {
		paths.push(...extractPathsFromPatch(args.patch));
	}

	if (typeof result === 'object' && result !== null) {
		const artifact = result.artifact as Record<string, unknown> | undefined;
		const patchStr = artifact?.patch as string | undefined;
		if (patchStr) {
			paths.push(...extractPathsFromPatch(patchStr));
		}
		const changes = result.changes as
			| Array<Record<string, unknown>>
			| undefined;
		if (Array.isArray(changes)) {
			for (const c of changes) {
				if (typeof c.filePath === 'string') paths.push(c.filePath);
			}
		}
	}

	return [...new Set(paths)];
}

export function isShellTool(name: string): boolean {
	return name === 'shell' || name === 'bash';
}

export function isWriteTool(name: string): boolean {
	return WRITE_TOOLS.includes(name);
}

export function formatToolTitle(
	name: string,
	args: Record<string, unknown> | undefined,
): string {
	switch (name) {
		case 'read':
			return `Read ${args?.path || 'file'}`;
		case 'edit':
			return `Edit ${args?.path || 'file'}`;
		case 'multiedit':
			return `Multi-edit ${args?.path || 'file'}`;
		case 'copy_into':
			return `Copy into ${args?.targetPath || 'file'}`;
		case 'write':
			return `Write ${args?.path || 'file'}`;
		case 'apply_patch':
			return 'Apply patch';
		case 'shell':
		case 'bash':
			return `Run: ${truncate(String(args?.cmd || 'command'), 60)}`;
		case 'ripgrep':
			return `Search: ${args?.query || ''}`;
		case 'glob':
			return `Find files: ${args?.pattern || ''}`;
		case 'ls':
			return `List ${args?.path || '.'}`;
		case 'tree':
			return `Tree ${args?.path || '.'}`;
		case 'git_status':
			return 'Git status';
		case 'git_diff':
			return 'Git diff';
		case 'web_search':
		case 'websearch':
			return `Search web: ${args?.query || ''}`;
		case 'web_fetch':
			return `Fetch: ${truncate(String(args?.url || ''), 60)}`;
		case 'terminal':
			return `Terminal: ${args?.operation || ''}`;
		case 'update_todos':
			return 'Update plan';
		case 'progress_update':
			return `Progress: ${args?.message || ''}`;
		case 'finish':
			return 'Done';
		default:
			return name;
	}
}

export function getToolKind(name: string): ToolKind {
	switch (name) {
		case 'read':
		case 'ls':
		case 'tree':
			return 'read';
		case 'edit':
		case 'multiedit':
		case 'copy_into':
		case 'write':
		case 'apply_patch':
			return 'edit';
		case 'shell':
		case 'bash':
		case 'terminal':
			return 'execute';
		case 'ripgrep':
		case 'glob':
		case 'web_search':
		case 'websearch':
			return 'search';
		case 'web_fetch':
			return 'fetch';
		case 'progress_update':
		case 'update_todos':
			return 'think';
		default:
			return 'other';
	}
}

export function getToolLocations(
	name: string,
	args: Record<string, unknown> | undefined,
	cwd: string,
): ToolCallLocation[] {
	if (!args) return [];

	const locations: ToolCallLocation[] = [];

	const filePath =
		(args.path as string) ||
		(args.targetPath as string) ||
		(args.filePath as string) ||
		(args.file as string);

	if (filePath && isFileTool(name)) {
		const absPath = path.isAbsolute(filePath)
			? filePath
			: path.join(cwd, filePath);

		const location: ToolCallLocation = { path: absPath };

		const startLine = args.startLine as number | undefined;
		if (startLine) {
			location.line = startLine;
		}

		locations.push(location);
	}

	if (name === 'apply_patch' && typeof args.patch === 'string') {
		const patchPaths = extractPathsFromPatch(args.patch as string);
		for (const p of patchPaths) {
			const absPath = path.isAbsolute(p) ? p : path.join(cwd, p);
			locations.push({ path: absPath });
		}
	}

	return locations;
}

export function extractPathsFromPatch(patch: string): string[] {
	const paths: string[] = [];
	const regex = /\*\*\* (?:Update|Add|Delete) File: (.+)/g;
	let match: RegExpExecArray | null = regex.exec(patch);
	while (match !== null) {
		paths.push(match[1].trim());
		match = regex.exec(patch);
	}
	return paths;
}

export function mapPlanStatus(
	status?: string,
): 'pending' | 'in_progress' | 'completed' {
	switch (status) {
		case 'in_progress':
			return 'in_progress';
		case 'completed':
			return 'completed';
		default:
			return 'pending';
	}
}

export function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}

function isFileTool(name: string): boolean {
	return [
		'read',
		'edit',
		'multiedit',
		'copy_into',
		'write',
		'ls',
		'tree',
	].includes(name);
}

function extractFilePath(
	_name: string,
	args: Record<string, unknown> | undefined,
	patch?: string,
): string | null {
	if (args?.path) return String(args.path);
	if (args?.filePath) return String(args.filePath);

	if (patch) {
		const match = patch.match(/\*\*\* (?:Update|Add) File: (.+)/);
		if (match) return match[1].trim();

		const diffMatch = patch.match(/^(?:---|\+\+\+) [ab]\/(.+)$/m);
		if (diffMatch) return diffMatch[1].trim();
	}

	return null;
}
