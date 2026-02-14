import type { Hono } from 'hono';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { serializeError } from '../runtime/errors/api-error.ts';
import { logger } from '@ottocode/sdk';
import { resolveBinary } from '@ottocode/sdk/tools/bin-manager';

const execAsync = promisify(exec);

const EXCLUDED_FILES = new Set([
	'.DS_Store',
	'bun.lockb',
	'.env',
	'.env.local',
	'.env.production',
	'.env.development',
]);

const EXCLUDED_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.nuxt',
	'.turbo',
	'.astro',
	'.svelte-kit',
	'.vercel',
	'.output',
	'coverage',
	'.cache',
	'__pycache__',
	'.tsbuildinfo',
]);

function shouldExcludeFile(name: string): boolean {
	return EXCLUDED_FILES.has(name);
}

function shouldExcludeDir(name: string): boolean {
	return EXCLUDED_DIRS.has(name);
}

async function listFilesWithRg(
	projectRoot: string,
	limit: number,
): Promise<{ files: string[]; truncated: boolean }> {
	const rgBin = await resolveBinary('rg');

	return new Promise((resolve) => {
		const args = ['--files', '--hidden', '--glob', '!.git/', '--sort', 'path'];

		const proc = spawn(rgBin, args, { cwd: projectRoot });
		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code !== 0 && code !== 1) {
				logger.warn('rg --files failed, falling back', { stderr } as Record<
					string,
					unknown
				>);
				resolve({ files: [], truncated: false });
				return;
			}

			const allFiles = stdout.split('\n').filter(Boolean);

			const filtered = allFiles.filter((f) => {
				const filename = f.split(/[\\/]/).pop() || f;
				return !shouldExcludeFile(filename);
			});

			const truncated = filtered.length > limit;
			resolve({ files: filtered.slice(0, limit), truncated });
		});

		proc.on('error', () => {
			resolve({ files: [], truncated: false });
		});
	});
}

async function parseGitignore(projectRoot: string): Promise<Set<string>> {
	const patterns = new Set<string>();
	try {
		const gitignorePath = join(projectRoot, '.gitignore');
		const content = await readFile(gitignorePath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				patterns.add(trimmed);
			}
		}
	} catch (_err) {}
	return patterns;
}

function matchesGitignorePattern(
	relativePath: string,
	patterns: Set<string>,
): boolean {
	for (const pattern of patterns) {
		const cleanPattern = pattern.replace(/^\//, '').replace(/\/$/, '');
		const pathParts = relativePath.split(/[\\/]/);

		if (pattern.endsWith('/')) {
			if (pathParts[0] === cleanPattern) return true;
			if (relativePath.startsWith(`${cleanPattern}/`)) return true;
		}

		if (pattern.includes('*')) {
			const regex = new RegExp(
				`^${cleanPattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
			);
			if (regex.test(relativePath)) return true;
			for (const part of pathParts) {
				if (regex.test(part)) return true;
			}
		} else {
			if (relativePath === cleanPattern) return true;
			if (pathParts.includes(cleanPattern)) return true;
			if (relativePath.startsWith(`${cleanPattern}/`)) return true;
		}
	}
	return false;
}

async function traverseDirectory(
	dir: string,
	projectRoot: string,
	maxDepth: number,
	currentDepth = 0,
	limit: number,
	collected: string[] = [],
	gitignorePatterns?: Set<string>,
): Promise<{ files: string[]; truncated: boolean }> {
	if (currentDepth >= maxDepth || collected.length >= limit) {
		return { files: collected, truncated: collected.length >= limit };
	}

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (collected.length >= limit) {
				return { files: collected, truncated: true };
			}

			const fullPath = join(dir, entry.name);
			const relativePath = relative(projectRoot, fullPath);

			if (entry.isDirectory()) {
				if (shouldExcludeDir(entry.name)) continue;
				if (
					gitignorePatterns &&
					matchesGitignorePattern(relativePath, gitignorePatterns)
				) {
					continue;
				}
				const result = await traverseDirectory(
					fullPath,
					projectRoot,
					maxDepth,
					currentDepth + 1,
					limit,
					collected,
					gitignorePatterns,
				);
				if (result.truncated) {
					return result;
				}
			} else if (entry.isFile()) {
				if (shouldExcludeFile(entry.name)) continue;
				if (
					gitignorePatterns &&
					matchesGitignorePattern(relativePath, gitignorePatterns)
				) {
					continue;
				}
				collected.push(relativePath);
			}
		}
	} catch (err) {
		logger.warn(
			`Failed to read directory ${dir}:`,
			err as Record<string, unknown>,
		);
	}

	return { files: collected, truncated: false };
}

async function getChangedFiles(
	projectRoot: string,
): Promise<Map<string, string>> {
	try {
		const { stdout } = await execAsync('git status --porcelain', {
			cwd: projectRoot,
		});
		const changedFiles = new Map<string, string>();
		for (const line of stdout.split('\n')) {
			if (line.length > 3) {
				const statusCode = line.substring(0, 2).trim();
				const filePath = line.substring(3).trim();

				let status = 'modified';
				if (statusCode.includes('A')) status = 'added';
				else if (statusCode.includes('M')) status = 'modified';
				else if (statusCode.includes('D')) status = 'deleted';
				else if (statusCode.includes('R')) status = 'renamed';
				else if (statusCode.includes('?')) status = 'untracked';

				changedFiles.set(filePath, status);
			}
		}
		return changedFiles;
	} catch (_err) {
		return new Map();
	}
}

export function registerFilesRoutes(app: Hono) {
	app.get('/v1/files', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const maxDepth = Number.parseInt(c.req.query('maxDepth') || '10', 10);
			const limit = Number.parseInt(c.req.query('limit') || '1000', 10);

			let result = await listFilesWithRg(projectRoot, limit);

			if (result.files.length === 0) {
				const gitignorePatterns = await parseGitignore(projectRoot);
				result = await traverseDirectory(
					projectRoot,
					projectRoot,
					maxDepth,
					0,
					limit,
					[],
					gitignorePatterns,
				);
			}

			const changedFiles = await getChangedFiles(projectRoot);

			result.files.sort((a, b) => {
				const aChanged = changedFiles.has(a);
				const bChanged = changedFiles.has(b);
				if (aChanged && !bChanged) return -1;
				if (!aChanged && bChanged) return 1;
				return a.localeCompare(b);
			});

			return c.json({
				files: result.files,
				changedFiles: Array.from(changedFiles.entries()).map(
					([path, status]) => ({
						path,
						status,
					}),
				),
				truncated: result.truncated,
			});
		} catch (err) {
			logger.error('Files route error:', err);
			return c.json({ error: serializeError(err) }, 500);
		}
	});

	app.get('/v1/files/tree', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const dirPath = c.req.query('path') || '.';
			const targetDir = join(projectRoot, dirPath);

			const gitignorePatterns = await parseGitignore(projectRoot);
			const entries = await readdir(targetDir, { withFileTypes: true });

			const items: Array<{
				name: string;
				path: string;
				type: 'file' | 'directory';
			}> = [];

			for (const entry of entries) {
				if (entry.name.startsWith('.') && entry.name !== '.otto') continue;
				const relPath = relative(projectRoot, join(targetDir, entry.name));

				if (entry.isDirectory()) {
					if (shouldExcludeDir(entry.name)) continue;
					if (matchesGitignorePattern(relPath, gitignorePatterns)) continue;
					items.push({ name: entry.name, path: relPath, type: 'directory' });
				} else if (entry.isFile()) {
					if (shouldExcludeFile(entry.name)) continue;
					if (matchesGitignorePattern(relPath, gitignorePatterns)) continue;
					items.push({ name: entry.name, path: relPath, type: 'file' });
				}
			}

			items.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
				return a.name.localeCompare(b.name);
			});

			return c.json({ items, path: dirPath });
		} catch (err) {
			logger.error('Files tree route error:', err);
			return c.json({ error: serializeError(err) }, 500);
		}
	});

	app.get('/v1/files/read', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const filePath = c.req.query('path');

			if (!filePath) {
				return c.json({ error: 'Missing required query parameter: path' }, 400);
			}

			const absPath = join(projectRoot, filePath);
			if (!absPath.startsWith(projectRoot)) {
				return c.json({ error: 'Path traversal not allowed' }, 403);
			}

			const content = await readFile(absPath, 'utf-8');
			const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
			const lineCount = content.split('\n').length;

			return c.json({ content, path: filePath, extension, lineCount });
		} catch (err) {
			logger.error('Files read route error:', err);
			return c.json({ error: serializeError(err) }, 500);
		}
	});

	app.get('/v1/files/raw', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const filePath = c.req.query('path');

			if (!filePath) {
				return c.json({ error: 'Missing required query parameter: path' }, 400);
			}

			const absPath = join(projectRoot, filePath);
			if (!absPath.startsWith(projectRoot)) {
				return c.json({ error: 'Path traversal not allowed' }, 403);
			}

			const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
			const mimeTypes: Record<string, string> = {
				png: 'image/png',
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				gif: 'image/gif',
				svg: 'image/svg+xml',
				webp: 'image/webp',
				ico: 'image/x-icon',
				bmp: 'image/bmp',
				avif: 'image/avif',
			};
			const contentType = mimeTypes[ext] || 'application/octet-stream';

			const data = await readFile(absPath);
			return new Response(data, {
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'no-cache',
				},
			});
		} catch (err) {
			logger.error('Files raw route error:', err);
			return c.json({ error: serializeError(err) }, 500);
		}
	});
}
