import type { Command } from 'commander';
import {
	getGlobalDebugLogPath,
	readDebugConfig,
	writeDebugConfig,
} from '@ottocode/sdk';

function parseScopes(rawScopes: string[]): string[] {
	return rawScopes
		.flatMap((value) => value.split(','))
		.map((value) => value.trim())
		.filter(Boolean);
}

export function registerDebugCommand(program: Command) {
	const debug = program
		.command('debug')
		.description('Manage shared debug logging');

	debug
		.command('on [scopes...]')
		.description('Enable debug logging globally, optionally limited to scopes')
		.action(async (scopes: string[] = []) => {
			const nextScopes = parseScopes(scopes);
			await writeDebugConfig({ enabled: true, scopes: nextScopes });
			const config = await readDebugConfig();
			console.log('Debug logging enabled');
			console.log(`Log file: ${config.logPath}`);
			if (config.scopes.length > 0) {
				console.log(`Scopes: ${config.scopes.join(', ')}`);
			} else {
				console.log('Scopes: all');
			}
		});

	debug
		.command('off')
		.description('Disable debug logging globally')
		.action(async () => {
			await writeDebugConfig({ enabled: false, scopes: [] });
			console.log('Debug logging disabled');
		});

	debug
		.command('status')
		.description('Show current debug logging status')
		.action(async () => {
			const config = await readDebugConfig();
			console.log(`Enabled: ${config.enabled ? 'yes' : 'no'}`);
			console.log(`Log file: ${config.logPath}`);
			console.log(`Session logs: ${config.sessionsDir}`);
			console.log(
				`Scopes: ${config.scopes.length > 0 ? config.scopes.join(', ') : 'all'}`,
			);
		});

	debug
		.command('path')
		.description('Print the main debug log path')
		.action(() => {
			console.log(getGlobalDebugLogPath());
		});
}
