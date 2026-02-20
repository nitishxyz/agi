import { intro, outro, select, isCancel, cancel, text } from '@clack/prompts';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { getGlobalConfigDir, validateSkillName } from '@ottocode/sdk';
import { listSkills, getSkill, validateSkill } from '@ottocode/api';
import { colors } from './ui.ts';

export interface SkillsOptions {
	project: string;
	json?: boolean;
}

type SkillSummary = {
	name: string;
	description: string;
	scope: string;
	path: string;
};

type SkillDetail = {
	name: string;
	description: string;
	license?: string | null;
	compatibility?: string | null;
	metadata?: unknown;
	allowedTools?: string[] | null;
	path: string;
	scope: string;
	content: string;
};

export async function runSkillsList(opts: SkillsOptions): Promise<void> {
	const { data, error } = await listSkills({
		query: { project: opts.project },
	});

	if (error || !data) {
		console.error('Failed to list skills');
		return;
	}

	const skills = (data as { skills: SkillSummary[] }).skills ?? [];

	if (opts.json) {
		console.log(JSON.stringify(skills, null, 2));
		return;
	}

	if (skills.length === 0) {
		console.log(colors.dim('No skills found.'));
		console.log('');
		console.log(
			colors.dim(
				'Create skills in .otto/skills/<name>/SKILL.md or ~/.config/otto/skills/<name>/SKILL.md',
			),
		);
		return;
	}

	console.log('');
	console.log(colors.bold('Discovered Skills'));
	console.log('');

	const byScope = new Map<string, SkillSummary[]>();
	for (const skill of skills) {
		const list = byScope.get(skill.scope) ?? [];
		list.push(skill);
		byScope.set(skill.scope, list);
	}

	const scopeOrder = ['cwd', 'parent', 'repo', 'user', 'system'];
	for (const scope of scopeOrder) {
		const list = byScope.get(scope);
		if (!list?.length) continue;

		console.log(colors.dim(`  [${scope}]`));
		for (const skill of list) {
			console.log(`    ${colors.cyan(skill.name)}`);
			console.log(`    ${colors.dim(skill.description)}`);
			console.log('');
		}
	}
}

export async function runSkillsShow(
	name: string,
	opts: SkillsOptions,
): Promise<void> {
	const { data, error } = await getSkill({
		path: { name },
		query: { project: opts.project },
	});

	if (error || !data) {
		console.error(colors.red(`Skill '${name}' not found`));
		process.exit(1);
	}

	const skill = data as SkillDetail;

	if (opts.json) {
		console.log(JSON.stringify(skill, null, 2));
		return;
	}

	console.log('');
	console.log(colors.bold(skill.name));
	console.log(colors.dim(skill.description));
	console.log('');
	console.log(colors.dim(`Path: ${skill.path}`));
	console.log(colors.dim(`Scope: ${skill.scope}`));
	if (skill.license) {
		console.log(colors.dim(`License: ${skill.license}`));
	}
	if (skill.compatibility) {
		console.log(colors.dim(`Compatibility: ${skill.compatibility}`));
	}
	console.log('');
	console.log(colors.dim('─'.repeat(60)));
	console.log('');
	console.log(skill.content);
	console.log('');
}

export async function runSkillsCreate(opts: SkillsOptions): Promise<void> {
	intro('Create a new skill');

	const nameInput = await text({
		message: 'Skill name (lowercase, hyphens allowed):',
		placeholder: 'my-skill',
		validate: (value) => {
			if (!value.trim()) return 'Name is required';
			if (!validateSkillName(value.trim())) {
				return 'Must be lowercase alphanumeric with hyphens (no start/end hyphens)';
			}
			return undefined;
		},
	});

	if (isCancel(nameInput)) {
		cancel('Cancelled');
		return;
	}

	const name = String(nameInput).trim();

	const descInput = await text({
		message: 'Description (helps agent know when to use it):',
		placeholder: 'Helps with...',
		validate: (value) => {
			if (!value.trim()) return 'Description is required';
			if (value.length > 1024) return 'Max 1024 characters';
			return undefined;
		},
	});

	if (isCancel(descInput)) {
		cancel('Cancelled');
		return;
	}

	const description = String(descInput).trim();

	const locationChoice = await select({
		message: 'Where to create the skill?',
		options: [
			{ value: 'project', label: 'Project (.otto/skills/)' },
			{ value: 'global', label: 'Global (~/.config/otto/skills/)' },
		],
	});

	if (isCancel(locationChoice)) {
		cancel('Cancelled');
		return;
	}

	const baseDir =
		locationChoice === 'global'
			? join(getGlobalConfigDir(), 'skills')
			: join(opts.project, '.otto/skills');

	const skillDir = join(baseDir, name);
	const skillPath = join(skillDir, 'SKILL.md');

	try {
		await fs.access(skillPath);
		outro(colors.red(`Skill already exists at ${skillPath}`));
		return;
	} catch {}

	const content = `---
name: ${name}
description: ${description}
---

## What I do

Describe what this skill does.

## When to use me

Explain when the agent should activate this skill.

## Steps

1. First step
2. Second step
3. Third step

## Examples

- Example usage
`;

	await fs.mkdir(skillDir, { recursive: true });
	await fs.writeFile(skillPath, content, 'utf-8');

	outro(`Created skill at ${colors.cyan(skillPath)}`);
}

export async function runSkillsValidate(
	path: string,
	_opts: SkillsOptions,
): Promise<void> {
	const skillPath = path.endsWith('SKILL.md') ? path : join(path, 'SKILL.md');

	try {
		await fs.access(skillPath);
	} catch {
		console.error(colors.red(`File not found: ${skillPath}`));
		process.exit(1);
	}

	const content = await fs.readFile(skillPath, 'utf-8');

	const { data } = await validateSkill({
		body: { content, path: skillPath },
	});

	const result = data as {
		valid: boolean;
		name?: string;
		description?: string;
		license?: string | null;
		error?: string;
	};

	if (result?.valid) {
		console.log(colors.green('✓ Valid skill'));
		console.log('');
		if (result.name) console.log(`  Name: ${result.name}`);
		if (result.description) console.log(`  Description: ${result.description}`);
		if (result.license) console.log(`  License: ${result.license}`);
	} else {
		console.error(colors.red('✗ Invalid skill'));
		console.error('');
		console.error(`  ${result?.error ?? 'Unknown error'}`);
		process.exit(1);
	}
}

export async function runSkills(
	subcommand: string | undefined,
	args: string[],
	projectRoot: string,
): Promise<boolean> {
	const json = args.includes('--json');

	const opts: SkillsOptions = {
		project: projectRoot,
		json,
	};

	switch (subcommand) {
		case 'list':
		case undefined:
			await runSkillsList(opts);
			return true;

		case 'show': {
			const name = args.find((a) => !a.startsWith('-'));
			if (!name) {
				console.error(colors.red('Usage: otto skills show <name>'));
				return true;
			}
			await runSkillsShow(name, opts);
			return true;
		}

		case 'create':
		case 'new':
			await runSkillsCreate(opts);
			return true;

		case 'validate': {
			const path = args.find((a) => !a.startsWith('-')) ?? '.';
			await runSkillsValidate(path, opts);
			return true;
		}

		default:
			console.error(colors.red(`Unknown skills subcommand: ${subcommand}`));
			console.log('');
			console.log('Available commands:');
			console.log('  otto skills list          List all discovered skills');
			console.log('  otto skills show <name>   Show skill content');
			console.log(
				'  otto skills create        Create a new skill (interactive)',
			);
			console.log('  otto skills validate [path]  Validate a SKILL.md file');
			return true;
	}
}
