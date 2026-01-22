import type { Command } from 'commander';
import {
	runSkillsList,
	runSkillsShow,
	runSkillsCreate,
	runSkillsValidate,
} from '../skills.ts';

export function registerSkillsCommand(program: Command) {
	const skills = program.command('skills').description('Manage agent skills');

	skills
		.command('list', { isDefault: true })
		.description('List all discovered skills')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--json', 'Output as JSON', false)
		.action(async (opts) => {
			await runSkillsList({ project: opts.project, json: opts.json });
		});

	skills
		.command('show <name>')
		.description('Show skill content')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--json', 'Output as JSON', false)
		.action(async (name, opts) => {
			await runSkillsShow(name, { project: opts.project, json: opts.json });
		});

	skills
		.command('create')
		.alias('new')
		.description('Create a new skill (interactive)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await runSkillsCreate({ project: opts.project });
		});

	skills
		.command('validate [path]')
		.description('Validate a SKILL.md file')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (skillPath, opts) => {
			await runSkillsValidate(skillPath ?? '.', { project: opts.project });
		});
}
