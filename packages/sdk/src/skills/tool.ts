import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import {
	loadSkill,
	discoverSkills,
	findGitRoot,
	loadSkillFile,
	discoverSkillFiles,
} from './loader.ts';
import { scanContent } from './security.ts';
import type { DiscoveredSkill, SkillResult } from './types.ts';

let cachedSkillList: DiscoveredSkill[] = [];
let initializedForPath: string | null = null;

export async function initializeSkills(
	cwd: string,
	repoRoot?: string,
): Promise<DiscoveredSkill[]> {
	const root = repoRoot ?? (await findGitRoot(cwd)) ?? cwd;
	cachedSkillList = await discoverSkills(cwd, root);
	initializedForPath = cwd;
	return cachedSkillList;
}

export function getDiscoveredSkills(): DiscoveredSkill[] {
	return cachedSkillList;
}

export function isSkillsInitialized(forPath?: string): boolean {
	if (!initializedForPath) return false;
	if (forPath && forPath !== initializedForPath) return false;
	return true;
}

export function buildSkillTool(): { name: string; tool: Tool } {
	const skillTool = tool({
		description: buildSkillDescription(),
		inputSchema: z.object({
			name: z.string().describe('Name of the skill to load'),
			file: z
				.string()
				.optional()
				.describe(
					'Optional relative file path within the skill directory to load a specific sub-file (e.g. "rules/animations.md")',
				),
		}),
		async execute({
			name,
			file,
		}: {
			name: string;
			file?: string;
		}): Promise<SkillResult> {
			if (file) {
				return loadSubFile(name, file);
			}
			return loadMainSkill(name);
		},
	});

	return { name: 'skill', tool: skillTool };
}

async function loadMainSkill(name: string): Promise<SkillResult> {
	const skill = await loadSkill(name);
	if (!skill) {
		return { ok: false, error: `Skill '${name}' not found` };
	}

	const [availableFiles, securityNotices] = await Promise.all([
		discoverSkillFiles(name),
		Promise.resolve(scanContent(skill.content)),
	]);

	return {
		ok: true,
		name: skill.metadata.name,
		description: skill.metadata.description,
		content: skill.content,
		path: skill.path,
		scope: skill.scope,
		allowedTools: skill.metadata.allowedTools,
		...(availableFiles.length > 0 && { availableFiles }),
		...(securityNotices.length > 0 && { securityNotices }),
	};
}

async function loadSubFile(
	name: string,
	filePath: string,
): Promise<SkillResult> {
	const skill = await loadSkill(name);
	if (!skill) {
		return { ok: false, error: `Skill '${name}' not found` };
	}

	const result = await loadSkillFile(name, filePath);
	if (!result) {
		const availableFiles = await discoverSkillFiles(name);
		const fileList = availableFiles.map((f) => f.relativePath).join(', ');
		return {
			ok: false,
			error: `File '${filePath}' not found or not readable in skill '${name}'. Available files: ${fileList || 'none'}`,
		};
	}

	const securityNotices = scanContent(result.content);

	return {
		ok: true,
		name: skill.metadata.name,
		description: `Sub-file: ${filePath}`,
		content: result.content,
		path: result.resolvedPath,
		scope: skill.scope,
		...(securityNotices.length > 0 && { securityNotices }),
	};
}

function buildSkillDescription(): string {
	if (cachedSkillList.length === 0) {
		return 'Load a skill by name. No skills are currently available.';
	}

	const skillsXml = cachedSkillList
		.map(
			(s) =>
				`<skill><name>${escapeXml(s.name)}</name><description>${escapeXml(s.description)}</description></skill>`,
		)
		.join('\n');

	return `Load a skill by name to get detailed instructions.

<available_skills>
${skillsXml}
</available_skills>

Call this tool with the skill name when you need the full instructions.
If the skill references sub-files (e.g. rules/animations.md), load them with the \`file\` parameter:
  skill({ name: "skill-name", file: "rules/animations.md" })

The response includes \`availableFiles\` listing all loadable sub-files in the skill directory.
If \`securityNotices\` are present, review them — they flag hidden content (HTML comments, invisible characters, etc.) that may not be visible when reading the markdown normally.`;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function rebuildSkillDescription(): string {
	return buildSkillDescription();
}
