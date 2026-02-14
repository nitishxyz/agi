import { Command } from 'commander';
import { setDebugEnabled, setTraceEnabled } from '@ottocode/server';
import { logger } from '@ottocode/sdk';
import {
	registerServeCommand,
	registerAskCommand,
	registerSessionsCommand,
	registerAuthCommand,
	registerModelsCommand,
	registerAgentsCommand,
	registerToolsCommand,
	registerSkillsCommand,
	registerScaffoldCommand,
	registerDoctorCommand,
	registerUpgradeCommand,
	registerSetuCommand,
	registerShareCommand,
	registerMCPCommand,
	registerWebCommand,
} from './commands/index.ts';
import { runDiscoveredCommand } from './custom-commands.ts';
import { handleServe } from './commands/serve.ts';
import { isDesktopInstalled, openDesktop } from './desktop.ts';
import { colors } from './ui.ts';

export function createCli(version: string): Command {
	const program = new Command();

	program
		.name('otto')
		.description('AI-powered development assistant CLI')
		.version(version, '-v, --version', 'Print version and exit')
		.option('--debug', 'Enable debug logging')
		.option('--trace', 'Enable stack traces in error logs')
		.option('--no-desktop', 'Skip desktop app and start server')
		.hook('preAction', (thisCommand) => {
			const opts = thisCommand.opts();
			if (opts.debug) {
				setDebugEnabled(true);
				console.log('[debug] Debug mode enabled');
			}
			if (opts.trace) {
				setTraceEnabled(true);
				if (opts.debug) {
					console.log(
						'[debug] Trace mode enabled (stack traces will be shown)',
					);
				}
			}
		});

	registerServeCommand(program, version);
	registerAskCommand(program);
	registerSessionsCommand(program);
	registerAuthCommand(program);
	registerModelsCommand(program);
	registerAgentsCommand(program);
	registerToolsCommand(program);
	registerSkillsCommand(program);
	registerScaffoldCommand(program);
	registerDoctorCommand(program);
	registerUpgradeCommand(program, version);
	registerSetuCommand(program);
	registerShareCommand(program);
	registerMCPCommand(program);
	registerWebCommand(program, version);

	return program;
}

export async function runCli(argv: string[], version: string): Promise<void> {
	const program = createCli(version);

	const projectIdx = argv.indexOf('--project');
	const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();

	const cmd = argv.find((arg) => !arg.startsWith('-'));
	if (cmd) {
		const discovered = await runDiscoveredCommand(
			cmd,
			argv.slice(argv.indexOf(cmd) + 1),
			projectRoot,
		);
		if (discovered) return;
	}

	if (
		argv.length === 0 ||
		(argv.every((arg) => arg.startsWith('-')) &&
			!argv.includes('-h') &&
			!argv.includes('--help') &&
			!argv.includes('-v') &&
			!argv.includes('--version') &&
			!argv.includes('--no-desktop'))
	) {
		const debugEnabled = argv.includes('--debug');
		const traceEnabled = argv.includes('--trace');
		if (debugEnabled) {
			setDebugEnabled(true);
			console.log('[debug] Debug mode enabled');
		}
		if (traceEnabled) {
			setTraceEnabled(true);
			if (debugEnabled) {
				console.log('[debug] Trace mode enabled');
			}
		}

		const noDesktop = argv.includes('--no-desktop');
		if (!noDesktop && isDesktopInstalled()) {
			console.log('');
			console.log(
				colors.bold('  ⚡ otto') + colors.dim(' — Opening desktop app...'),
			);
			console.log('');
			const opened = openDesktop(projectRoot);
			if (opened) return;
			console.log(
				colors.dim('  Failed to open desktop app, falling back to serve'),
			);
			console.log('');
		}

		const noOpen = argv.includes('--no-open');
		const networkFlag = argv.includes('--network');
		const portFlagIndex = argv.indexOf('--port');
		const port =
			portFlagIndex >= 0 ? Number(argv[portFlagIndex + 1]) : undefined;

		await handleServe(
			{
				project: projectRoot,
				port,
				network: networkFlag,
				noOpen,
			},
			version,
		);
		return;
	}

	await program.parseAsync(argv, { from: 'user' });
}

process.on('unhandledRejection', (reason) => {
	logger.error('Unhandled Promise Rejection', reason);
	process.exit(1);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception', error);
	process.exit(1);
});
