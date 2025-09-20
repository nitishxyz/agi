import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import { embeddedTextAssets } from '@/runtime/assets.ts';
import { createTwoFilesPatch } from 'diff';

function normalizePath(p: string) {
	const parts = p.replace(/\\/g, '/').split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') stack.pop();
		else stack.push(part);
	}
	return `/${stack.join('/')}`;
}

function resolveSafePath(projectRoot: string, p: string) {
	const root = normalizePath(projectRoot);
	const abs = normalizePath(`${root}/${p || '.'}`);
	if (!(abs === root || abs.startsWith(`${root}/`))) {
		throw new Error(`Path escapes project root: ${p}`);
	}
	return abs;
}

export function buildFsTools(
	projectRoot: string,
): Array<{ name: string; tool: Tool }> {
	const read: Tool = tool({
		description: 'Read a text file from the project',
		inputSchema: z.object({
			path: z.string().describe('Relative file path within the project'),
		}),
		async execute({ path }: { path: string }) {
			const abs = resolveSafePath(projectRoot, path);
			const f = Bun.file(abs);
			if (await f.exists()) {
				const content = await f.text();
				return { path, content, size: content.length };
			}
			// Fallback: if compiled with embedded assets and the requested file
			// is one of the known text assets, serve from the embedded bundle
			const embedded = embeddedTextAssets[path];
			if (embedded) {
				const ef = Bun.file(embedded);
				const content = await ef.text();
				return { path, content, size: content.length };
			}
			throw new Error(`File not found: ${path}`);
		},
	});

	const write: Tool = tool({
		description:
			'Write text to a file in the project (creates file if missing)',
		inputSchema: z.object({
			path: z.string().describe('Relative file path within the project'),
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
		}) {
			const abs = resolveSafePath(projectRoot, path);
			if (createDirs) {
				await $`mkdir -p ${abs.slice(0, abs.lastIndexOf('/'))}`;
			}
			let existed = false;
			let oldText = '';
			try {
				const f = Bun.file(abs);
				existed = await f.exists();
				if (existed) oldText = await f.text();
			} catch {}
			await Bun.write(abs, content);
			const artifact = await buildWriteArtifact(
				path,
				existed,
				oldText,
				content,
			);
			return { path, bytes: content.length, artifact } as const;
		},
	});

	const ls: Tool = tool({
		description: 'List files and directories at a path',
		inputSchema: z.object({
			path: z.string().default('.').describe('Relative directory path'),
		}),
		async execute({ path }: { path: string }) {
			const abs = resolveSafePath(projectRoot, path || '.');
			// Use ls -1p to mark directories with trailing '/'
			const out = await $`ls -1p ${abs}`.text().catch(() => '');
			const lines = out.split('\n').filter(Boolean);
			const entries = lines.map((name) => ({
				name: name.replace(/\/$/, ''),
				type: name.endsWith('/') ? 'dir' : 'file',
			}));
			return { path, entries };
		},
	});

	const tree: Tool = tool({
		description: 'Show a directory tree (limited depth)',
		inputSchema: z.object({
			path: z.string().default('.'),
			depth: z.number().int().min(1).max(5).default(2),
		}),
		async execute({ path, depth }: { path: string; depth: number }) {
			const start = resolveSafePath(projectRoot, path || '.');
			const base = start.endsWith('/') ? start.slice(0, -1) : start;

			async function listDir(
				dir: string,
			): Promise<Array<{ name: string; isDir: boolean }>> {
				const out = await $`ls -1Ap ${dir}`.text().catch(() => '');
				const lines = out.split('\n').filter(Boolean);
				return lines.map((name) => ({
					name: name.replace(/\/$/, ''),
					isDir: name.endsWith('/'),
				}));
			}

			const lines: string[] = [];
			async function walk(
				abs: string,
				rel: string,
				level: number,
				prefix: string,
			) {
				if (level > depth) return;
				const entries = await listDir(abs);
				const maxEntries = 200;
				const shown = entries.slice(0, maxEntries);
				const more = entries.length - shown.length;
				shown.forEach(async (e, idx) => {
					const isLast = idx === shown.length - 1;
					const connector = isLast ? '└─ ' : '├─ ';
					const line = `${prefix}${connector}${e.isDir ? '📁' : '📄'} ${rel ? `${rel}/` : ''}${e.name}`;
					lines.push(line);
					if (e.isDir && level < depth) {
						const childAbs = `${abs}/${e.name}`;
						const childRel = rel ? `${rel}/${e.name}` : e.name;
						const nextPrefix = prefix + (isLast ? '   ' : '│  ');
						await walk(childAbs, childRel, level + 1, nextPrefix);
					}
				});
				if (more > 0) lines.push(`${prefix}… and ${more} more`);
			}

			lines.push(`${'📁'} .`);
			await walk(base, '', 1, '');
			return { path, depth, tree: lines.join('\n') };
		},
	});

	const pwd: Tool = tool({
		description: 'Print working directory (relative to project root)',
		inputSchema: z.object({}).optional(),
		async execute() {
			// Actual cwd resolution is handled in the adapter; this is a placeholder schema
			return { cwd: '.' };
		},
	});

	const cd: Tool = tool({
		description: 'Change working directory (relative to project root)',
		inputSchema: z.object({
			path: z.string().describe('Relative directory path'),
		}),
		async execute({ path }: { path: string }) {
			// Actual cwd update is handled in the adapter; this is a placeholder schema
			return { cwd: path };
		},
	});

	return [
		{ name: 'read', tool: read },
		{ name: 'write', tool: write },
		{ name: 'ls', tool: ls },
		{ name: 'tree', tool: tree },
		{ name: 'pwd', tool: pwd },
		{ name: 'cd', tool: cd },
	];
}

async function buildWriteArtifact(
	relPath: string,
	_existed: boolean,
	oldText: string,
	newText: string,
) {
	// Prefer library-generated unified diff for better hunk formatting
	let patch = '';
	try {
		// Use a/ and b/ prefixes so headers look familiar
		patch = createTwoFilesPatch(
			`a/${relPath}`,
			`b/${relPath}`,
			String(oldText ?? ''),
			String(newText ?? ''),
			'',
			'',
			{ context: 3 },
		);
	} catch {}
	if (!patch || !patch.trim().length) {
		// Fallback: extremely compact synthetic patch
		const header = _existed ? 'Update File' : 'Add File';
		const oldLines = String(oldText ?? '').split('\n');
		const newLines = String(newText ?? '').split('\n');
		const lines: string[] = [];
		lines.push('*** Begin Patch');
		lines.push(`*** ${header}: ${relPath}`);
		lines.push('@@');
		if (_existed) for (const l of oldLines) lines.push(`-${l}`);
		for (const l of newLines) lines.push(`+${l}`);
		lines.push('*** End Patch');
		patch = lines.join('\n');
	}
	const { additions, deletions } = summarizePatchCounts(patch);
	return {
		kind: 'file_diff',
		patch,
		summary: { files: 1, additions, deletions },
	} as const;
}

function summarizePatchCounts(patch: string): {
	additions: number;
	deletions: number;
} {
	let adds = 0;
	let dels = 0;
	for (const line of String(patch || '').split('\n')) {
		if (
			line.startsWith('+++') ||
			line.startsWith('---') ||
			line.startsWith('diff ')
		)
			continue;
		if (line.startsWith('+')) adds += 1;
		else if (line.startsWith('-')) dels += 1;
	}
	return { additions: adds, deletions: dels };
}
