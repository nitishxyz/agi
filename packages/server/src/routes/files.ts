import type { Hono } from 'hono';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { serializeError } from '../runtime/errors/api-error.ts';
import { logger } from '@ottocode/sdk';
import { resolveBinary } from '@ottocode/sdk/tools/bin-manager';
import { openApiRoute } from '../openapi/route.ts';

const execAsync = promisify(exec);

const EXCLUDED_FILES = new Set(['.DS_Store', 'bun.lockb']);

const HOME_SEARCH_MAX_DEPTH = 3;
const HOME_SEARCH_LIMIT = 500;
const DEFAULT_SEARCH_MAX_DEPTH = 12;
const DEFAULT_SEARCH_LIMIT = 10_000;
const TREE_ENTRY_LIMIT = 1000;

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
	'target',
	'.cargo',
	'.rustup',
	'vendor',
	'.gradle',
	'.idea',
	'.vscode',
]);

type SearchPolicy = {
	maxDepth: number;
	limit: number;
	includeIgnored: boolean;
};

function isHomeDirectory(projectRoot: string): boolean {
	return resolve(projectRoot) === resolve(homedir());
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return max;
	return Math.min(Math.max(value, min), max);
}

function getSearchPolicy(projectRoot: string): SearchPolicy {
	if (isHomeDirectory(projectRoot)) {
		return {
			maxDepth: HOME_SEARCH_MAX_DEPTH,
			limit: HOME_SEARCH_LIMIT,
			includeIgnored: false,
		};
	}
	return {
		maxDepth: DEFAULT_SEARCH_MAX_DEPTH,
		limit: DEFAULT_SEARCH_LIMIT,
		includeIgnored: false,
	};
}

function shouldExcludeFile(name: string): boolean {
	return EXCLUDED_FILES.has(name);
}

function shouldExcludeDir(name: string): boolean {
	return EXCLUDED_DIRS.has(name);
}

function shouldExcludeSearchDir(name: string): boolean {
	return shouldExcludeDir(name) || name.startsWith('.');
}

async function listFilesWithRg(
	projectRoot: string,
	maxDepth: number,
	limit: number,
	includeIgnored = false,
	query = '',
): Promise<{ files: string[]; truncated: boolean }> {
	const rgBin = await resolveBinary('rg');

	return new Promise((resolve) => {
		const args = ['--files', '--sort', 'path', '--max-depth', String(maxDepth)];
		if (includeIgnored) {
			args.push('--no-ignore');
		}
		for (const dir of EXCLUDED_DIRS) {
			args.push('--glob', `!**/${dir}/**`);
		}

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

			const normalizedQuery = query.trim().toLowerCase();
			const filtered = allFiles.filter((f) => {
				const filename = f.split(/[\\/]/).pop() || f;
				if (shouldExcludeFile(filename)) return false;
				if (!normalizedQuery) return true;
				return f.toLowerCase().includes(normalizedQuery);
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
				if (shouldExcludeSearchDir(entry.name)) continue;
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

async function getGitIgnoredFiles(
	projectRoot: string,
	files: string[],
): Promise<Set<string>> {
	if (files.length === 0) return new Set();
	try {
		return new Promise((resolve) => {
			const proc = spawn('git', ['check-ignore', '--stdin'], {
				cwd: projectRoot,
			});
			let stdout = '';
			proc.stdout.on('data', (data) => {
				stdout += data.toString();
			});
			proc.on('close', () => {
				resolve(new Set(stdout.split('\n').filter(Boolean)));
			});
			proc.on('error', () => {
				resolve(new Set());
			});
			proc.stdin.write(files.join('\n'));
			proc.stdin.end();
		});
	} catch (_err) {
		return new Set();
	}
}

export function registerFilesRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/files',
			tags: ['files'],
			operationId: 'listFiles',
			summary: 'List project files',
			description:
				'Returns list of files in the project directory, excluding common build artifacts and dependencies',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'query',
					name: 'maxDepth',
					required: false,
					schema: {
						type: 'integer',
						default: 10,
					},
					description: 'Maximum directory depth to traverse',
				},
				{
					in: 'query',
					name: 'limit',
					required: false,
					schema: {
						type: 'integer',
						default: 1000,
					},
					description: 'Maximum number of files to return',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									files: {
										type: 'array',
										items: {
											type: 'string',
										},
									},
									changedFiles: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												path: {
													type: 'string',
												},
												status: {
													type: 'string',
													enum: [
														'added',
														'modified',
														'deleted',
														'renamed',
														'untracked',
													],
												},
											},
											required: ['path', 'status'],
										},
										description:
											'List of files with uncommitted changes (from git status)',
									},
									truncated: {
										type: 'boolean',
									},
								},
								required: ['files', 'changedFiles', 'truncated'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const policy = getSearchPolicy(projectRoot);
				const maxDepth = clampNumber(
					Number.parseInt(
						c.req.query('maxDepth') || String(policy.maxDepth),
						10,
					),
					1,
					policy.maxDepth,
				);
				const limit = clampNumber(
					Number.parseInt(c.req.query('limit') || String(policy.limit), 10),
					1,
					policy.limit,
				);

				let result = await listFilesWithRg(
					projectRoot,
					maxDepth,
					limit,
					policy.includeIgnored,
				);

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

				const [changedFiles, ignoredFiles] = await Promise.all([
					getChangedFiles(projectRoot),
					getGitIgnoredFiles(projectRoot, result.files),
				]);

				result.files.sort((a, b) => {
					const aIgnored = ignoredFiles.has(a);
					const bIgnored = ignoredFiles.has(b);
					if (aIgnored !== bIgnored) return aIgnored ? 1 : -1;
					const aChanged = changedFiles.has(a);
					const bChanged = changedFiles.has(b);
					if (aChanged && !bChanged) return -1;
					if (!aChanged && bChanged) return 1;
					return a.localeCompare(b);
				});

				return c.json({
					files: result.files,
					ignoredFiles: Array.from(ignoredFiles),
					changedFiles: Array.from(changedFiles.entries()).map(
						([path, status]) => ({
							path,
							status,
						}),
					),
					truncated: result.truncated,
					policy: {
						maxDepth,
						limit,
						home: isHomeDirectory(projectRoot),
					},
				});
			} catch (err) {
				logger.error('Files route error:', err);
				return c.json({ error: serializeError(err) }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/files/search',
			tags: ['files'],
			operationId: 'searchFiles',
			summary: 'Search project files',
			description:
				'Searches files for mentions and quick-open. Excludes dependencies, build artifacts, and gitignored files by default.',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'query',
					name: 'q',
					required: false,
					schema: {
						type: 'string',
						default: '',
					},
					description: 'Search query',
				},
				{
					in: 'query',
					name: 'maxDepth',
					required: false,
					schema: {
						type: 'integer',
					},
					description: 'Maximum directory depth to traverse',
				},
				{
					in: 'query',
					name: 'limit',
					required: false,
					schema: {
						type: 'integer',
					},
					description: 'Maximum number of files to return',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									files: {
										type: 'array',
										items: {
											type: 'string',
										},
									},
									changedFiles: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												path: {
													type: 'string',
												},
												status: {
													type: 'string',
												},
											},
											required: ['path', 'status'],
										},
									},
									truncated: {
										type: 'boolean',
									},
								},
								required: ['files', 'changedFiles', 'truncated'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const query = c.req.query('q') || '';
				const policy = getSearchPolicy(projectRoot);
				const maxDepth = clampNumber(
					Number.parseInt(
						c.req.query('maxDepth') || String(policy.maxDepth),
						10,
					),
					1,
					policy.maxDepth,
				);
				const limit = clampNumber(
					Number.parseInt(c.req.query('limit') || String(policy.limit), 10),
					1,
					policy.limit,
				);

				let result = await listFilesWithRg(
					projectRoot,
					maxDepth,
					limit,
					policy.includeIgnored,
					query,
				);

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
					const normalizedQuery = query.trim().toLowerCase();
					if (normalizedQuery) {
						const files = result.files.filter((file) =>
							file.toLowerCase().includes(normalizedQuery),
						);
						result = {
							files: files.slice(0, limit),
							truncated: files.length > limit,
						};
					}
				}

				const [changedFiles, ignoredFiles] = await Promise.all([
					getChangedFiles(projectRoot),
					getGitIgnoredFiles(projectRoot, result.files),
				]);

				result.files.sort((a, b) => {
					const aIgnored = ignoredFiles.has(a);
					const bIgnored = ignoredFiles.has(b);
					if (aIgnored !== bIgnored) return aIgnored ? 1 : -1;
					const aChanged = changedFiles.has(a);
					const bChanged = changedFiles.has(b);
					if (aChanged && !bChanged) return -1;
					if (!aChanged && bChanged) return 1;
					return a.localeCompare(b);
				});

				return c.json({
					files: result.files,
					ignoredFiles: Array.from(ignoredFiles),
					changedFiles: Array.from(changedFiles.entries()).map(
						([path, status]) => ({
							path,
							status,
						}),
					),
					truncated: result.truncated,
					policy: {
						maxDepth,
						limit,
						home: isHomeDirectory(projectRoot),
					},
				});
			} catch (err) {
				logger.error('Files search route error:', err);
				return c.json({ error: serializeError(err) }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/files/tree',
			tags: ['files'],
			operationId: 'getFileTree',
			summary: 'Get directory tree listing',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'query',
					name: 'path',
					required: false,
					schema: {
						type: 'string',
						default: '.',
					},
					description: 'Directory path relative to project root',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									items: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												path: {
													type: 'string',
												},
												type: {
													type: 'string',
													enum: ['file', 'directory'],
												},
												gitignored: {
													type: 'boolean',
												},
												vendor: {
													type: 'boolean',
												},
												searchable: {
													type: 'boolean',
												},
											},
											required: ['name', 'path', 'type'],
										},
									},
									path: {
										type: 'string',
									},
									truncated: {
										type: 'boolean',
									},
								},
								required: ['items', 'path', 'truncated'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const dirPath = c.req.query('path') || '.';
				const targetDir = resolve(projectRoot, dirPath);
				if (!targetDir.startsWith(resolve(projectRoot))) {
					return c.json({ error: 'Path traversal not allowed' }, 403);
				}

				const gitignorePatterns = await parseGitignore(projectRoot);
				const entries = await readdir(targetDir, { withFileTypes: true });
				const truncated = entries.length > TREE_ENTRY_LIMIT;

				const items: Array<{
					name: string;
					path: string;
					type: 'file' | 'directory';
					gitignored?: boolean;
					vendor?: boolean;
					searchable?: boolean;
				}> = [];

				for (const entry of entries.slice(0, TREE_ENTRY_LIMIT)) {
					const relPath = relative(projectRoot, join(targetDir, entry.name));

					if (entry.isDirectory()) {
						const ignored = matchesGitignorePattern(relPath, gitignorePatterns);
						const vendor = shouldExcludeDir(entry.name);
						items.push({
							name: entry.name,
							path: relPath,
							type: 'directory',
							gitignored: ignored || undefined,
							vendor: vendor || undefined,
							searchable: vendor || ignored ? false : undefined,
						});
					} else if (entry.isFile()) {
						if (shouldExcludeFile(entry.name)) continue;
						const ignored = matchesGitignorePattern(relPath, gitignorePatterns);
						items.push({
							name: entry.name,
							path: relPath,
							type: 'file',
							gitignored: ignored || undefined,
							searchable: ignored ? false : undefined,
						});
					}
				}

				items.sort((a, b) => {
					if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
					const aIgnored = a.gitignored ?? false;
					const bIgnored = b.gitignored ?? false;
					if (aIgnored !== bIgnored) return aIgnored ? 1 : -1;
					return a.name.localeCompare(b.name);
				});

				return c.json({ items, path: dirPath, truncated });
			} catch (err) {
				logger.error('Files tree route error:', err);
				return c.json({ error: serializeError(err) }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/files/read',
			tags: ['files'],
			operationId: 'readFile',
			summary: 'Read file content',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'query',
					name: 'path',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'File path relative to project root',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									content: {
										type: 'string',
									},
									path: {
										type: 'string',
									},
									extension: {
										type: 'string',
									},
									lineCount: {
										type: 'integer',
									},
								},
								required: ['content', 'path', 'extension', 'lineCount'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const filePath = c.req.query('path');

				if (!filePath) {
					return c.json(
						{ error: 'Missing required query parameter: path' },
						400,
					);
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/files/raw',
			tags: ['files'],
			operationId: 'getFileRaw',
			summary: 'Read raw file bytes',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: { type: 'string' },
					description:
						'Project root override (defaults to current working directory).',
				},
				{
					in: 'query',
					name: 'path',
					required: true,
					schema: { type: 'string' },
					description: 'Relative file path to read.',
				},
			],
			responses: {
				'200': {
					description: 'Raw file content',
					content: {
						'application/octet-stream': {
							schema: { type: 'string', format: 'binary' },
						},
					},
				},
				'400': { description: 'Missing path parameter' },
				'403': { description: 'Path traversal not allowed' },
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const filePath = c.req.query('path');

				if (!filePath) {
					return c.json(
						{ error: 'Missing required query parameter: path' },
						400,
					);
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
		},
	);
}
