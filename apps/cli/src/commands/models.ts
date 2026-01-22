import type { Command } from 'commander';
import { runModels } from '../models.ts';

export function registerModelsCommand(program: Command) {
	program
		.command('models')
		.alias('switch')
		.description('Pick default provider/model (interactive)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--local', 'Store selection locally', false)
		.action(async (opts) => {
			await runModels({ project: opts.project, local: opts.local });
		});
}
