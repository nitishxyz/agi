import type { Command } from 'commander';
import { runScaffold } from '../scaffold.ts';

export function registerScaffoldCommand(program: Command) {
	program
		.command('scaffold')
		.alias('generate')
		.description('Create agents, tools, or commands (interactive)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--local', 'Create in local project directory', false)
		.action(async (opts) => {
			await runScaffold({ project: opts.project, local: opts.local });
		});
}
