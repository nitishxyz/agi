import { Command } from 'commander';
import { logger, setDebugEnabled, setTraceEnabled } from '@ottocode/sdk';
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
	registerDebugCommand,
	registerUpgradeCommand,
	registerOttoRouterCommand,
	registerShareCommand,
	registerMCPCommand,
	registerWebCommand,
} from './commands/index.ts';
import { runDiscoveredCommand } from './custom-commands.ts';
import { startApiServer } from './commands/serve.ts';
import { handleServe } from './commands/serve.ts';
import { startTui } from '@ottocode/tui';
import { ensureAuth } from './middleware/with-auth.ts';

import { ensureServer, stopEphemeralServer } from './ask/server.ts';

const SKIP_SERVER_COMMANDS = new Set([
	'serve',
	'upgrade',
	'help',
	'auth',
	'debug',
	'web',
]);

export function createCli(version: string): Command {
	const program = new Command();

	program
		.name('otto')
		.description('AI-powered development assistant CLI')
		.version(version, '-v, --version', 'Print version and exit')
		.option('--web', 'Open Web UI instead of TUI')
		.hook('preAction', async (_thisCommand, actionCommand) => {
			const cmdName = actionCommand.name();
			if (!SKIP_SERVER_COMMANDS.has(cmdName)) {
				await ensureServer();
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
	registerDebugCommand(program);
	registerUpgradeCommand(program, version);
	registerOttoRouterCommand(program);
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
			!argv.includes('--version'))
	) {
		const debugEnabled = argv.includes('--debug');
		const traceEnabled = argv.includes('--trace');
		if (debugEnabled) {
			setDebugEnabled(true);
		}
		if (traceEnabled) {
			setTraceEnabled(true);
		}

		const useWeb = argv.includes('--web');
		const portFlagIndex = argv.indexOf('--port');
		const port =
			portFlagIndex >= 0 ? Number(argv[portFlagIndex + 1]) : undefined;

		if (useWeb) {
			const noOpen = argv.includes('--no-open');
			const networkFlag = argv.includes('--network');
			await handleServe(
				{
					project: projectRoot,
					port,
					network: networkFlag,
					noOpen,
					tunnel: false,
				},
				version,
			);
			return;
		}

		const server = await startApiServer({ project: projectRoot, port });
		if (!(await ensureAuth(projectRoot))) return;
		await startTui(server.port, server.stop);
		return;
	}

	try {
		await program.parseAsync(argv, { from: 'user' });
	} finally {
		await stopEphemeralServer();
	}
}

process.on('unhandledRejection', (reason) => {
	logger.error('Unhandled Promise Rejection', reason);
	process.exit(1);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception', error);
	process.exit(1);
});
