import { join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import { parseSkillFile } from './parser.ts';
import type { SkillDefinition, DiscoveredSkill, SkillScope } from './types.ts';
import { getGlobalConfigDir, getHomeDir } from '../config/src/paths.ts';

const skillCache = new Map<string, SkillDefinition>();

const SKILL_DIRS = [
	'.agi/skills',
	'.claude/skills',
	'.opencode/skills',
	'.codex/skills',
];

export async function discoverSkills(
	cwd: string,
	repoRoot?: string,
): Promise<DiscoveredSkill[]> {
	const skills = new Map<string, SkillDefinition>();
	const home = getHomeDir();

	const globalDirs = [
		join(getGlobalConfigDir(), 'skills'),
		join(home, '.claude/skills'),
		join(home, '.config/opencode/skills'),
		join(home, '.codex/skills'),
	];
	for (const dir of globalDirs) {
		await loadSkillsFromDir(dir, 'user', skills);
	}

	if (repoRoot && repoRoot !== cwd) {
		for (const skillDir of SKILL_DIRS) {
			await loadSkillsFromDir(join(repoRoot, skillDir), 'repo', skills);
		}
	}

	let current = cwd;
	const visited = new Set<string>();
	while (current && !visited.has(current)) {
		visited.add(current);
		const scope: SkillScope =
			current === cwd ? 'cwd' : current === repoRoot ? 'repo' : 'parent';
		for (const skillDir of SKILL_DIRS) {
			await loadSkillsFromDir(join(current, skillDir), scope, skills);
		}
		const parent = dirname(current);
		if (parent === current) break;
		if (repoRoot && !current.startsWith(repoRoot)) break;
		current = parent;
	}

	skillCache.clear();
	for (const [name, def] of skills) {
		skillCache.set(name, def);
	}

	return Array.from(skills.values()).map((s) => ({
		name: s.metadata.name,
		description: s.metadata.description,
		path: s.path,
		scope: s.scope,
	}));
}

export async function loadSkill(name: string): Promise<SkillDefinition | null> {
	return skillCache.get(name) ?? null;
}

export function getSkillCache(): Map<string, SkillDefinition> {
	return skillCache;
}

export function clearSkillCache(): void {
	skillCache.clear();
}

async function loadSkillsFromDir(
	dir: string,
	scope: SkillScope,
	skills: Map<string, SkillDefinition>,
): Promise<void> {
	try {
		await fs.access(dir);
	} catch {
		return;
	}

	const pattern = '*/SKILL.md';
	let files: string[];
	try {
		files = await fg(pattern, { cwd: dir, absolute: true });
	} catch {
		return;
	}

	for (const filePath of files) {
		try {
			const content = await fs.readFile(filePath, 'utf-8');
			const skill = parseSkillFile(content, filePath, scope);

			const dirName = dirname(filePath).split('/').pop();
			if (dirName !== skill.metadata.name) {
				if (process.env.AGI_DEBUG === '1') {
					console.warn(
						`Skill name '${skill.metadata.name}' doesn't match directory '${dirName}' in ${filePath}`,
					);
				}
			}

			skills.set(skill.metadata.name, skill);
		} catch (err) {
			if (process.env.AGI_DEBUG === '1') {
				console.error(`Failed to load skill from ${filePath}:`, err);
			}
		}
	}
}

export async function findGitRoot(startDir: string): Promise<string | null> {
	let current = startDir;
	const visited = new Set<string>();

	while (current && !visited.has(current)) {
		visited.add(current);
		try {
			await fs.access(join(current, '.git'));
			return current;
		} catch {
			const parent = dirname(current);
			if (parent === current) break;
			current = parent;
		}
	}

	return null;
}

export async function listSkillsInDir(dir: string): Promise<string[]> {
	try {
		await fs.access(dir);
	} catch {
		return [];
	}

	const pattern = '*/SKILL.md';
	const files = await fg(pattern, { cwd: dir, absolute: false });

	return files.map((f) => dirname(f));
}
