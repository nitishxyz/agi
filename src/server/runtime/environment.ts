import { getHomeDir } from '@/config/paths.ts';

export async function getEnvironmentContext(
	projectRoot: string,
): Promise<string> {
	const parts: string[] = [];

	parts.push(
		'Here is some useful information about the environment you are running in:',
	);
	parts.push('<env>');
	parts.push(`  Working directory: ${projectRoot}`);

	try {
		const { existsSync } = await import('node:fs');
		const isGitRepo = existsSync(`${projectRoot}/.git`);
		parts.push(`  Is directory a git repo: ${isGitRepo ? 'yes' : 'no'}`);
	} catch {
		parts.push('  Is directory a git repo: unknown');
	}

	parts.push(`  Platform: ${process.platform}`);
	parts.push(`  Today's date: ${new Date().toDateString()}`);
	parts.push('</env>');

	return parts.join('\n');
}

export async function getProjectTree(projectRoot: string): Promise<string> {
	try {
		const { promisify } = await import('node:util');
		const { exec } = await import('node:child_process');
		const execAsync = promisify(exec);

		const { stdout } = await execAsync(
			'git ls-files 2>/dev/null || find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" 2>/dev/null | head -100',
			{ cwd: projectRoot, maxBuffer: 1024 * 1024 },
		);

		if (!stdout.trim()) return '';

		const files = stdout.trim().split('\n').slice(0, 100);
		return `<project>\n${files.join('\n')}\n</project>`;
	} catch {
		return '';
	}
}

export async function findInstructionFiles(
	projectRoot: string,
): Promise<string[]> {
	const { existsSync } = await import('node:fs');
	const { join } = await import('node:path');
	const foundPaths: string[] = [];

	const localFiles = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md'];
	for (const filename of localFiles) {
		let currentDir = projectRoot;
		for (let i = 0; i < 5; i++) {
			const filePath = join(currentDir, filename);
			if (existsSync(filePath)) {
				foundPaths.push(filePath);
				break;
			}
			const parentDir = join(currentDir, '..');
			if (parentDir === currentDir) break;
			currentDir = parentDir;
		}
	}

	const homeDir = getHomeDir();
	const globalFiles = [
		join(homeDir, '.config', 'agi', 'AGENTS.md'),
		join(homeDir, '.claude', 'CLAUDE.md'),
	];

	for (const filePath of globalFiles) {
		if (existsSync(filePath) && !foundPaths.includes(filePath)) {
			foundPaths.push(filePath);
		}
	}

	return foundPaths;
}

export async function loadInstructionFiles(
	projectRoot: string,
): Promise<string> {
	const paths = await findInstructionFiles(projectRoot);
	if (paths.length === 0) return '';

	const contents: string[] = [];

	for (const path of paths) {
		try {
			const file = Bun.file(path);
			const content = await file.text();
			if (content.trim()) {
				contents.push(
					`\n--- Custom Instructions from ${path} ---\n${content.trim()}`,
				);
			}
		} catch {}
	}

	return contents.join('\n');
}

export async function composeEnvironmentAndInstructions(
	projectRoot: string,
	options?: { includeProjectTree?: boolean },
): Promise<string> {
	const parts: string[] = [];

	const envContext = await getEnvironmentContext(projectRoot);
	parts.push(envContext);

	if (options?.includeProjectTree !== false) {
		const projectTree = await getProjectTree(projectRoot);
		if (projectTree) {
			parts.push(projectTree);
		}
	}

	const customInstructions = await loadInstructionFiles(projectRoot);
	if (customInstructions) {
		parts.push(customInstructions);
	}

	return parts.filter(Boolean).join('\n\n');
}
