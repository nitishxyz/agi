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
		return 'Load a skill by name to get detailed, task-specific instructions. No skills are currently available.';
	}

	// Dedupe by name — later scopes (cwd > repo > user) have already overwritten
	// earlier ones in the loader, so the cached list is deduplicated. We re-dedupe
	// defensively here in case the same name slipped through from different dirs.
	const seen = new Set<string>();
	const unique: DiscoveredSkill[] = [];
	for (const s of cachedSkillList) {
		const key = s.name.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(s);
	}
	unique.sort((a, b) => a.name.localeCompare(b.name));

	const skillsXml = unique
		.map(
			(s) =>
				`<skill><name>${escapeXml(s.name)}</name><description>${escapeXml(summarizeDescription(s.description))}</description><location>${escapeXml(s.scope)}</location></skill>`,
		)
		.join('\n');

	return `Load a skill by name to get detailed, task-specific instructions.

<skills_instructions>
When the user's request matches one of the available skills below, call this tool with the skill name to load its full instructions. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke with \`skill({ name: "<skill-name>" })\` — only the name is required.
- The response contains the skill's full body plus \`availableFiles\` for sub-files.
- For sub-files: \`skill({ name: "<skill-name>", file: "rules/animations.md" })\`.

Rules:
- Only invoke skills listed in <available_skills> below.
- Do NOT invoke speculatively. Only call when the user's request clearly matches a skill's description or trigger phrases.
- Do NOT invoke the same skill twice in one turn.
- If a skill response includes \`securityNotices\`, review them — they flag hidden content (HTML comments, invisible characters, etc.) that may not render visibly.
</skills_instructions>

<available_skills>
${skillsXml}
</available_skills>`;
}

function escapeXml(str: string): string {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// Condense a SKILL.md description to "what it does + when to use it".
//
// Most frontmatter follows one of two shapes:
//   A. "<what>. Use when <triggers>. Also use when … For X, see Y."
//   B. "When the user wants X. Also use when <mega trigger list>. For Y, see Z."
//
// Rule: keep up to two sentences, but STOP early at cues that mark pure
// trigger-list expansion or see-also chatter ("Also use when …", "For X, see Y",
// "Use this …"). Sentence 1 is always kept. Sentence 2 is kept only if it's a
// "Use when …" clause (trigger phrases the model actually needs) — not an
// "Also use when" balloon.
const SENTENCE_END = /[.!?]\s/g;
const SKIP_PREFIXES = [
	/^also use when\b/i,
	/^for [^.]*?,?\s*see\b/i,
	/^see\s+/i,
	/^use this\b/i,
	/^use proactively\b/i,
	/^distinct from\b/i,
	/^different from\b/i,
	/^not for\b/i,
];

function shouldSkipSentence(sentence: string): boolean {
	const s = sentence.trim();
	return SKIP_PREFIXES.some((re) => re.test(s));
}

export function summarizeDescription(raw: string): string {
	const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
	if (!text) return '';

	// Split into sentences, keeping terminal punctuation.
	const sentences: string[] = [];
	SENTENCE_END.lastIndex = 0;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
	while ((match = SENTENCE_END.exec(text)) !== null) {
		sentences.push(text.slice(lastIndex, match.index + 1).trim());
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) sentences.push(text.slice(lastIndex).trim());

	if (sentences.length === 0) return text;

	const kept: string[] = [sentences[0]]; // always keep sentence 1 (what)
	// Keep sentence 2 only if it adds routing signal (e.g. starts with "Use when").
	if (sentences[1] && !shouldSkipSentence(sentences[1])) {
		kept.push(sentences[1]);
	}

	return kept.join(' ');
}

export function rebuildSkillDescription(): string {
	return buildSkillDescription();
}
