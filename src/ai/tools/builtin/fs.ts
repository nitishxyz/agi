import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import { embeddedTextAssets } from '@/runtime/assets.ts';

function normalizePath(p: string) {
	const parts = p.replace(/\\/g, '/').split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') stack.pop();
		else stack.push(part);
	}
	return '/' + stack.join('/');
}

function resolveSafePath(projectRoot: string, p: string) {
	const root = normalizePath(projectRoot);
	const abs = normalizePath(root + '/' + (p || '.'));
	if (!(abs === root || abs.startsWith(root + '/'))) {
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
			await Bun.write(abs, content);
			return { path, bytes: content.length };
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
					const line = `${prefix}${connector}${e.isDir ? '📁' : '📄'} ${rel ? rel + '/' : ''}${e.name}`;
					lines.push(line);
					if (e.isDir && level < depth) {
						const childAbs = abs + '/' + e.name;
						const childRel = rel ? rel + '/' + e.name : e.name;
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
		{ name: 'fs_read', tool: read },
		{ name: 'fs_write', tool: write },
		{ name: 'fs_ls', tool: ls },
		{ name: 'fs_tree', tool: tree },
		{ name: 'fs_pwd', tool: pwd },
		{ name: 'fs_cd', tool: cd },
	];
}
