import { tool, type Tool } from 'ai';
import { z } from 'zod/v3';
import { loadSkill, discoverSkills, findGitRoot } from './loader.ts';
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
		}),
		async execute({ name }: { name: string }): Promise<SkillResult> {
			const skill = await loadSkill(name);
			if (!skill) {
				return { ok: false, error: `Skill '${name}' not found` };
			}
			return {
				ok: true,
				name: skill.metadata.name,
				description: skill.metadata.description,
				content: skill.content,
				path: skill.path,
				scope: skill.scope,
				allowedTools: skill.metadata.allowedTools,
			};
		},
	});

	return { name: 'skill', tool: skillTool };
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

Call this tool with the skill name when you need the full instructions.`;
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
