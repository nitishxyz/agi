import type { Command } from 'commander';
import { runAuth, runAuthList, runAuthLogout } from '../auth.ts';

export function registerAuthCommand(program: Command) {
	const auth = program
		.command('auth')
		.description('Manage provider credentials');

	auth
		.command('login [provider]')
		.description('Add or update provider credentials')
		.option('--local', 'Store credentials locally (deprecated)', false)
		.action(async (provider, opts) => {
			const args = provider ? [provider] : [];
			if (opts.local) args.push('--local');
			await runAuth(['login', ...args]);
		});

	auth
		.command('list')
		.alias('ls')
		.description('List stored credentials')
		.action(async () => {
			await runAuthList([]);
		});

	auth
		.command('logout')
		.alias('rm')
		.alias('remove')
		.description('Remove stored credentials')
		.option('--local', 'Remove from local storage', false)
		.action(async (opts) => {
			const args: string[] = [];
			if (opts.local) args.push('--local');
			await runAuthLogout(args);
		});

	program
		.command('setup')
		.description('Alias for `auth login`')
		.action(async () => {
			await runAuth(['login']);
		});
}
