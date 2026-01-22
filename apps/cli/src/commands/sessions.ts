import type { Command } from 'commander';
import { runSessions } from '../sessions.ts';
import { ensureAuth } from '../middleware/with-auth.ts';

export interface SessionsOptions {
	project: string;
	json: boolean;
	list: boolean;
	pick: boolean;
	limit?: number;
}

export async function handleSessions(opts: SessionsOptions) {
	if (!(await ensureAuth(opts.project))) return;

	const pick = !opts.list && !opts.json ? true : opts.pick;
	await runSessions({
		project: opts.project,
		json: opts.json,
		pick,
		limit: opts.limit,
	});
}

export function registerSessionsCommand(program: Command) {
	program
		.command('sessions')
		.description('Manage or pick sessions (default: pick)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--json', 'Output as JSON', false)
		.option('--list', 'List sessions without interactive picker', false)
		.option('--pick', 'Show interactive session picker', false)
		.option('--limit <n>', 'Limit number of sessions', (v) =>
			Number.parseInt(v, 10),
		)
		.action(async (opts) => {
			await handleSessions({
				project: opts.project,
				json: opts.json,
				list: opts.list,
				pick: opts.pick,
				limit: opts.limit,
			});
		});
}
