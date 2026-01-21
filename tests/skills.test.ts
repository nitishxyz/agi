import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import {
	parseSkillFile,
	validateSkillName,
	discoverSkills,
	clearSkillCache,
} from '../packages/sdk/src/skills/index.ts';

describe('Skills', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `agi-skills-test-${Date.now()}`);
		await fs.mkdir(tempDir, { recursive: true });
		clearSkillCache();
	});

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	describe('validateSkillName', () => {
		test('accepts valid names', () => {
			expect(validateSkillName('git-release')).toBe(true);
			expect(validateSkillName('my-skill')).toBe(true);
			expect(validateSkillName('skill123')).toBe(true);
			expect(validateSkillName('a')).toBe(true);
			expect(validateSkillName('abc')).toBe(true);
		});

		test('rejects invalid names', () => {
			expect(validateSkillName('')).toBe(false);
			expect(validateSkillName('My-Skill')).toBe(false);
			expect(validateSkillName('-skill')).toBe(false);
			expect(validateSkillName('skill-')).toBe(false);
			expect(validateSkillName('skill--name')).toBe(false);
			expect(validateSkillName('skill_name')).toBe(false);
			expect(validateSkillName('skill.name')).toBe(false);
			expect(validateSkillName('a'.repeat(65))).toBe(false);
		});
	});

	describe('parseSkillFile', () => {
		test('parses valid SKILL.md', () => {
			const content = `---
name: git-release
description: Create releases and changelogs
---

## What I do
Create releases.
`;
			const skill = parseSkillFile(content, '/path/to/SKILL.md', 'cwd');

			expect(skill.metadata.name).toBe('git-release');
			expect(skill.metadata.description).toBe('Create releases and changelogs');
			expect(skill.content).toContain('## What I do');
			expect(skill.scope).toBe('cwd');
		});

		test('parses optional fields', () => {
			const content = `---
name: my-skill
description: A skill with all fields
license: MIT
compatibility: Requires git
metadata:
  author: test
  version: "1.0"
allowed-tools: Bash(git:*) Read
---

Content here.
`;
			const skill = parseSkillFile(content, '/path/to/SKILL.md', 'user');

			expect(skill.metadata.name).toBe('my-skill');
			expect(skill.metadata.license).toBe('MIT');
			expect(skill.metadata.compatibility).toBe('Requires git');
			expect(skill.metadata.metadata?.author).toBe('test');
			expect(skill.metadata.metadata?.version).toBe('1.0');
			expect(skill.scope).toBe('user');
		});

		test('throws on missing frontmatter', () => {
			const content = `# No frontmatter
Just content.
`;
			expect(() => parseSkillFile(content, '/path/to/SKILL.md', 'cwd')).toThrow(
				'missing frontmatter',
			);
		});

		test('throws on missing name', () => {
			const content = `---
description: No name field
---

Content.
`;
			expect(() => parseSkillFile(content, '/path/to/SKILL.md', 'cwd')).toThrow(
				"Missing required 'name'",
			);
		});

		test('throws on missing description', () => {
			const content = `---
name: my-skill
---

Content.
`;
			expect(() => parseSkillFile(content, '/path/to/SKILL.md', 'cwd')).toThrow(
				"Missing required 'description'",
			);
		});

		test('throws on invalid name', () => {
			const content = `---
name: My-Invalid-Name
description: Test
---

Content.
`;
			expect(() => parseSkillFile(content, '/path/to/SKILL.md', 'cwd')).toThrow(
				'Invalid skill name',
			);
		});
	});

	describe('discoverSkills', () => {
		test('discovers skills from .agi/skills/', async () => {
			const skillDir = join(tempDir, '.agi/skills/test-skill');
			await fs.mkdir(skillDir, { recursive: true });
			await fs.writeFile(
				join(skillDir, 'SKILL.md'),
				`---
name: test-skill
description: A test skill
---

Test content.
`,
			);

			const skills = await discoverSkills(tempDir);

			const testSkill = skills.find((s) => s.name === 'test-skill');
			expect(testSkill).toBeDefined();
			expect(testSkill?.description).toBe('A test skill');
			expect(testSkill?.scope).toBe('cwd');
		});

		test('discovers skills from .claude/skills/', async () => {
			const skillDir = join(tempDir, '.claude/skills/claude-skill');
			await fs.mkdir(skillDir, { recursive: true });
			await fs.writeFile(
				join(skillDir, 'SKILL.md'),
				`---
name: claude-skill
description: Claude compatible skill
---

Content.
`,
			);

			const skills = await discoverSkills(tempDir);

			const claudeSkill = skills.find((s) => s.name === 'claude-skill');
			expect(claudeSkill).toBeDefined();
			expect(claudeSkill?.name).toBe('claude-skill');
		});

		test('later paths override earlier (scope precedence)', async () => {
			const globalSkillDir = join(
				tempDir,
				'global/.config/agi/skills/shared-skill',
			);
			const projectSkillDir = join(tempDir, 'project/.agi/skills/shared-skill');

			await fs.mkdir(globalSkillDir, { recursive: true });
			await fs.mkdir(projectSkillDir, { recursive: true });

			await fs.writeFile(
				join(globalSkillDir, 'SKILL.md'),
				`---
name: shared-skill
description: Global version
---

Global content.
`,
			);

			await fs.writeFile(
				join(projectSkillDir, 'SKILL.md'),
				`---
name: shared-skill
description: Project version
---

Project content.
`,
			);

			const projectRoot = join(tempDir, 'project');
			const skills = await discoverSkills(projectRoot);

			const sharedSkill = skills.find((s) => s.name === 'shared-skill');
			expect(sharedSkill).toBeDefined();
			expect(sharedSkill?.description).toBe('Project version');
		});

		test('does not find project skills in empty temp dir', async () => {
			const skills = await discoverSkills(tempDir);
			const projectSkills = skills.filter(
				(s) => s.scope === 'cwd' || s.scope === 'repo',
			);
			expect(projectSkills).toEqual([]);
		});

		test('ignores invalid SKILL.md files', async () => {
			const validDir = join(tempDir, '.agi/skills/valid-skill');
			const invalidDir = join(tempDir, '.agi/skills/invalid-skill');

			await fs.mkdir(validDir, { recursive: true });
			await fs.mkdir(invalidDir, { recursive: true });

			await fs.writeFile(
				join(validDir, 'SKILL.md'),
				`---
name: valid-skill
description: Valid skill
---

Content.
`,
			);

			await fs.writeFile(join(invalidDir, 'SKILL.md'), `# No frontmatter`);

			const skills = await discoverSkills(tempDir);

			const validSkill = skills.find((s) => s.name === 'valid-skill');
			const invalidSkill = skills.find((s) => s.name === 'invalid-skill');
			expect(validSkill).toBeDefined();
			expect(invalidSkill).toBeUndefined();
		});
	});
});
