import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

const IGNORED_NAMES = new Set([
	'.git',
	'.idea',
	'.next',
	'.turbo',
	'.venv',
	'.vscode',
	'dist',
	'build',
	'coverage',
	'node_modules',
	'target',
]);

const KEY_DIRECTORY_LIMIT = 24;
const WORKSPACE_LIMIT = 24;

/** Returns true when the message is the built-in /init command. */
export function isInitCommand(content: string): boolean {
	return content.trim().toLowerCase() === '/init';
}

/** System instructions for the focused /init repo-analysis run. */
export function getInitCommandSystemPrompt(): string {
	return [
		'You are generating durable agent instructions for this repository.',
		'',
		'Your job is to inspect the real project structure and source code, then create or refresh AGENTS.md documentation for future coding agents.',
		'',
		'Hard rules:',
		'- Do not trust existing markdown as the source of truth; code, config, and filesystem structure win when there is a conflict.',
		'- Inspect actual package manifests, source directories, route wiring, schemas, app entrypoints, and build configuration before writing.',
		'- Prefer a small number of strong docs over many tiny docs.',
		'- If this is a monorepo, create a root AGENTS.md that acts as the routing/index doc and points to a small set of focused docs under .agents/.',
		'- If this is not a monorepo, root AGENTS.md may stay mostly self-contained with only minimal supporting docs.',
		'- Root AGENTS.md must tell future agents which .agents doc to read for mobile, server/api, web/tui clients, database, and cross-cutting changes when applicable.',
		'- Avoid oversplitting. Only create supporting docs when a domain is meaningfully distinct. Aim for roughly 3-6 supporting docs max when splitting is needed.',
		'- Keep docs actionable for coding agents: architecture, key file paths, workflow rules, and when to consult related docs.',
		'- Reuse and update existing AGENTS.md or .agents docs when appropriate instead of duplicating content.',
		'',
		'Expected process:',
		'1. Scan the repository structure and key code/config files with tools.',
		'2. Decide the minimum useful documentation split.',
		'3. Write or update AGENTS.md and any needed .agents/*.md files.',
		'4. Finish with a concise summary of what you generated and why.',
	].join('\n');
}

/** Builds a concise filesystem-grounded snapshot to seed the /init run. */
export async function buildInitProjectSnapshot(
	projectRoot: string,
): Promise<string> {
	const rootManifest = await readJson<Record<string, unknown>>(
		join(projectRoot, 'package.json'),
	);
	const workspacePatterns = extractWorkspacePatterns(rootManifest?.workspaces);
	const workspaceDirs = await collectWorkspaceDirs(
		projectRoot,
		workspacePatterns,
	);
	const topLevelDirs = await listDirectoryNames(
		projectRoot,
		true,
		KEY_DIRECTORY_LIMIT,
	);
	const topLevelFiles = await listDirectoryNames(
		projectRoot,
		false,
		KEY_DIRECTORY_LIMIT,
	);
	const appDirs = await listDirectoryNames(
		join(projectRoot, 'apps'),
		true,
		KEY_DIRECTORY_LIMIT,
	);
	const packageDirs = await listDirectoryNames(
		join(projectRoot, 'packages'),
		true,
		KEY_DIRECTORY_LIMIT,
	);
	const docsDirs = await listDirectoryNames(
		join(projectRoot, 'docs'),
		false,
		KEY_DIRECTORY_LIMIT,
	);
	const routeFiles = await listDirectoryNames(
		join(projectRoot, 'packages/server/src/routes'),
		false,
		KEY_DIRECTORY_LIMIT,
	);
	const schemaFiles = await listDirectoryNames(
		join(projectRoot, 'packages/database/src/schema'),
		false,
		KEY_DIRECTORY_LIMIT,
	);
	const sdkDirs = await listDirectoryNames(
		join(projectRoot, 'packages/sdk/src'),
		true,
		KEY_DIRECTORY_LIMIT,
	);
	const webSdkDirs = await listDirectoryNames(
		join(projectRoot, 'packages/web-sdk/src'),
		true,
		KEY_DIRECTORY_LIMIT,
	);
	const existingAgentDocs = await summarizeExistingAgentDocs(projectRoot);
	const workspaceSummaries = await Promise.all(
		workspaceDirs.slice(0, WORKSPACE_LIMIT).map(async (workspaceDir) => {
			const rel = toProjectRelative(projectRoot, workspaceDir);
			const manifest = await readJson<Record<string, unknown>>(
				join(workspaceDir, 'package.json'),
			);
			return summarizeWorkspace(rel, manifest);
		}),
	);

	const runtimeSignals = [
		(await exists(join(projectRoot, 'bun.lock'))) ? 'bun.lock' : null,
		(await exists(join(projectRoot, 'bunfig.toml'))) ? 'bunfig.toml' : null,
		(await exists(join(projectRoot, 'biome.json'))) ? 'biome.json' : null,
		(await exists(join(projectRoot, 'tsconfig.base.json')))
			? 'tsconfig.base.json'
			: null,
		(await exists(join(projectRoot, 'docker'))) ? 'docker/' : null,
	].filter((value): value is string => Boolean(value));

	const lines = [
		`Project root: ${projectRoot}`,
		`Repo shape: ${workspacePatterns.length > 0 || workspaceDirs.length > 1 ? 'monorepo/workspace' : 'single-project or minimal workspace'}`,
		rootManifest?.name ? `Root package: ${String(rootManifest.name)}` : null,
		workspacePatterns.length
			? `Workspace globs: ${workspacePatterns.join(', ')}`
			: 'Workspace globs: none declared',
		runtimeSignals.length
			? `Tooling signals: ${runtimeSignals.join(', ')}`
			: null,
		topLevelDirs.length
			? `Top-level directories: ${topLevelDirs.join(', ')}`
			: null,
		topLevelFiles.length
			? `Top-level files: ${topLevelFiles.join(', ')}`
			: null,
		appDirs.length ? `apps/: ${appDirs.join(', ')}` : null,
		packageDirs.length ? `packages/: ${packageDirs.join(', ')}` : null,
		docsDirs.length ? `docs/: ${docsDirs.join(', ')}` : null,
		routeFiles.length
			? `packages/server/src/routes: ${routeFiles.join(', ')}`
			: null,
		schemaFiles.length
			? `packages/database/src/schema: ${schemaFiles.join(', ')}`
			: null,
		sdkDirs.length ? `packages/sdk/src dirs: ${sdkDirs.join(', ')}` : null,
		webSdkDirs.length
			? `packages/web-sdk/src dirs: ${webSdkDirs.join(', ')}`
			: null,
		existingAgentDocs,
		workspaceSummaries.length ? 'Workspace packages:' : null,
		...workspaceSummaries.map((summary) => `- ${summary}`),
	]
		.filter((line): line is string => Boolean(line))
		.join('\n');

	return lines;
}

/** Builds the primary user prompt for /init after the repo snapshot is collected. */
export function buildInitCommandUserPrompt(
	projectRoot: string,
	snapshot: string,
): string {
	return [
		'Generate or refresh the repository agent documentation for this project.',
		'',
		'Deliverables:',
		'- Root AGENTS.md at the repository root.',
		'- Supporting docs under .agents/ only when needed.',
		'',
		'What to analyze before writing:',
		'- monorepo boundaries and workspace responsibilities',
		'- how server/API routes are wired',
		'- how web and TUI clients are wired',
		'- whether mobile deserves its own doc',
		'- database/schema/migration locations',
		'- SDK/shared packages and build/test tooling',
		'',
		'Document design rules:',
		'- Root AGENTS.md should be the primary entrypoint and routing guide for future LLM agents.',
		'- Root AGENTS.md should point to the exact .agents docs to read for different task types.',
		'- If a task touches multiple layers, root AGENTS.md should say to read multiple docs.',
		'- Prefer fewer, stronger docs. Do not scatter tiny markdown files.',
		'- Keep instructions concrete and file-path-aware.',
		'- Mention repository-specific norms that matter for safe changes.',
		'',
		'Repository snapshot (filesystem-grounded, still verify with tools):',
		'<project-snapshot>',
		snapshot,
		'</project-snapshot>',
		'',
		`Project root for file writes: ${projectRoot}`,
		'',
		'Now inspect the real code/config with tools, decide the right doc split, and write the docs.',
	].join('\n');
}

async function summarizeExistingAgentDocs(
	projectRoot: string,
): Promise<string | null> {
	const rootAgents = (await exists(join(projectRoot, 'AGENTS.md')))
		? 'AGENTS.md'
		: null;
	const subdocs = await listDirectoryNames(
		join(projectRoot, '.agents'),
		false,
		KEY_DIRECTORY_LIMIT,
	);
	if (!rootAgents && subdocs.length === 0) return null;
	return `Existing agent docs: ${[rootAgents, ...subdocs].filter(Boolean).join(', ')}`;
}

async function collectWorkspaceDirs(
	projectRoot: string,
	patterns: string[],
): Promise<string[]> {
	const found = new Set<string>();
	for (const pattern of patterns) {
		for (const match of await expandWorkspacePattern(projectRoot, pattern)) {
			found.add(match);
		}
	}

	if (found.size === 0) {
		for (const fallbackRoot of ['apps', 'packages', 'examples']) {
			for (const dir of await listSubdirectories(
				join(projectRoot, fallbackRoot),
			)) {
				found.add(dir);
			}
		}
	}

	return Array.from(found).sort((a, b) => a.localeCompare(b));
}

async function expandWorkspacePattern(
	projectRoot: string,
	pattern: string,
): Promise<string[]> {
	const normalized = pattern.replace(/\\/g, '/').replace(/\/$/, '');
	if (!normalized.endsWith('/*')) return [];
	const base = normalized.slice(0, -2);
	if (!base || base.includes('*')) return [];
	return listSubdirectories(join(projectRoot, base));
}

function extractWorkspacePatterns(workspaces: unknown): string[] {
	if (Array.isArray(workspaces)) {
		return workspaces.filter(
			(value): value is string => typeof value === 'string',
		);
	}
	if (
		workspaces &&
		typeof workspaces === 'object' &&
		Array.isArray((workspaces as { packages?: unknown }).packages)
	) {
		return (workspaces as { packages: unknown[] }).packages.filter(
			(value): value is string => typeof value === 'string',
		);
	}
	return [];
}

function summarizeWorkspace(
	relPath: string,
	manifest?: Record<string, unknown>,
): string {
	const name =
		typeof manifest?.name === 'string'
			? manifest.name
			: `(${basename(relPath)})`;
	const scripts =
		manifest?.scripts && typeof manifest.scripts === 'object'
			? Object.keys(manifest.scripts as Record<string, unknown>).slice(0, 6)
			: [];
	const flags = [
		typeof manifest?.private === 'boolean'
			? manifest.private
				? 'private'
				: 'public'
			: null,
		scripts.length ? `scripts: ${scripts.join(', ')}` : null,
	]
		.filter((value): value is string => Boolean(value))
		.join(' | ');
	return flags ? `${relPath} → ${name} (${flags})` : `${relPath} → ${name}`;
}

async function listSubdirectories(path: string): Promise<string[]> {
	try {
		const entries = await readdir(path, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory() && !shouldIgnore(entry.name))
			.map((entry) => join(path, entry.name))
			.sort((a, b) => a.localeCompare(b));
	} catch {
		return [];
	}
}

async function listDirectoryNames(
	path: string,
	directoriesOnly: boolean,
	limit: number,
): Promise<string[]> {
	try {
		const entries = await readdir(path, { withFileTypes: true });
		return entries
			.filter((entry) => !shouldIgnore(entry.name))
			.filter((entry) =>
				directoriesOnly ? entry.isDirectory() : !entry.isDirectory(),
			)
			.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
			.sort((a, b) => a.localeCompare(b))
			.slice(0, limit);
	} catch {
		return [];
	}
}

function shouldIgnore(name: string): boolean {
	return IGNORED_NAMES.has(name) || name.startsWith('.DS_Store');
}

async function readJson<T>(path: string): Promise<T | undefined> {
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) return undefined;
		return (await file.json()) as T;
	} catch {
		return undefined;
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		return await Bun.file(path).exists();
	} catch {
		return false;
	}
}

function toProjectRelative(projectRoot: string, absPath: string): string {
	const rel = relative(projectRoot, absPath).replace(/\\/g, '/');
	return rel.length > 0 ? rel : '.';
}
