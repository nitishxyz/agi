import type { Command } from 'commander';
import { runAgents } from '../agents.ts';

export function registerAgentsCommand(program: Command) {
	program
		.command('agents')
		.description('Edit agents.json entries (interactive)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--local', 'Edit local project agents', false)
		.action(async (opts) => {
			await runAgents({ project: opts.project, local: opts.local });
		});
}
