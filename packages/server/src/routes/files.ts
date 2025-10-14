import type { Hono } from 'hono';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { serializeError } from '../runtime/api-error.ts';
import { logger } from '../runtime/logger.ts';

const execAsync = promisify(exec);

const EXCLUDED_PATTERNS = [
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.nuxt',
	'.turbo',
	'coverage',
	'.cache',
	'.DS_Store',
	'bun.lockb',
	'.env',
	'.env.local',
	'.env.production',
	'.env.development',
];

function shouldExclude(name: string): boolean {
	for (const pattern of EXCLUDED_PATTERNS) {
		if (pattern.includes('*')) {
			const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
			if (regex.test(name)) return true;
		} else if (name === pattern || name.endsWith(pattern)) {
			return true;
		}
	}
	return false;
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
		const pathParts = relativePath.split('/');

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

			if (shouldExclude(entry.name)) {
				continue;
			}

			const fullPath = join(dir, entry.name);
			const relativePath = relative(projectRoot, fullPath);

			if (
				gitignorePatterns &&
				matchesGitignorePattern(relativePath, gitignorePatterns)
			) {
				continue;
			}

			if (entry.isDirectory()) {
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
				collected.push(relativePath);
			}
		}
	} catch (err) {
		logger.warn(`Failed to read directory ${dir}:`, err);
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
		return new Set();
	}
}

export function registerFilesRoutes(app: Hono) {
	app.get('/v1/files', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const maxDepth = Number.parseInt(c.req.query('maxDepth') || '10', 10);
			const limit = Number.parseInt(c.req.query('limit') || '1000', 10);

			const gitignorePatterns = await parseGitignore(projectRoot);

			const result = await traverseDirectory(
				projectRoot,
				projectRoot,
				maxDepth,
				0,
				limit,
				[],
				gitignorePatterns,
			);

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
}
