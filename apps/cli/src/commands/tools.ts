import type { Command } from 'commander';
import { runToolsList } from '../tools.ts';

export function registerToolsCommand(program: Command) {
	program
		.command('tools')
		.description('List discovered tools and agent access')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await runToolsList({ project: opts.project });
		});
}
