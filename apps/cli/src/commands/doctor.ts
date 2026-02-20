import type { Command } from 'commander';
import { runDoctorCommand } from '../doctor.ts';

export function registerDoctorCommand(program: Command) {
	program
		.command('doctor')
		.description('Diagnose auth, defaults, and agent/tool issues')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await runDoctorCommand({ project: opts.project });
		});
}
