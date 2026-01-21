import {
	loadConfig,
	isProviderAuthorized,
	getTerminalManager,
	type ProviderId,
	openAuthUrl,
	logger,
} from '@agi-cli/sdk';
import {
	createApp as createServer,
	setDebugEnabled,
	setTraceEnabled,
} from '@agi-cli/server';
import { getDb } from '@agi-cli/database';
import { runAsk } from './src/ask.ts';
import { runSessions } from './src/sessions.ts';
import { intro, outro, text, isCancel, cancel } from '@clack/prompts';
import { runAuth } from './src/auth.ts';
import { runModels } from './src/models.ts';
import { discoverCommands, runDiscoveredCommand } from './src/commands.ts';
import { runScaffold } from './src/scaffold.ts';
import { runAgents } from './src/agents.ts';
import { runToolsList } from './src/tools.ts';
import { runDoctor } from './src/doctor.ts';
import { createWebServer } from './src/web-server.ts';
import { colors } from './src/ui.ts';

const createApp = createServer;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PKG from './package.json' with { type: 'json' };

let argv = process.argv.slice(2);

if (argv[0] === 'agi' || argv[0]?.endsWith('/agi')) {
	argv = argv.slice(1);
}

const cmd = argv[0];

const ASK_ALIASES = new Set(['ask', 'run', 'do', 'a']);

async function main() {
	const debugEnabled = argv.includes('--debug');
	const traceEnabled = argv.includes('--trace');

	if (debugEnabled) {
		setDebugEnabled(true);
		console.log('[debug] Debug mode enabled');
	}

	if (traceEnabled) {
		setTraceEnabled(true);
		if (debugEnabled) {
			console.log('[debug] Trace mode enabled (stack traces will be shown)');
		}
	}

	if (debugEnabled) {
		console.log('DEBUG: process.argv:', process.argv);
		console.log('DEBUG: argv (after cleanup):', argv);
		console.log('DEBUG: cmd:', cmd);
	}

	const wantsVersion = argv.includes('--version') || argv.includes('-v');
	if (wantsVersion) {
		const version = (PKG as { version: string }).version;
		Bun.write(Bun.stdout, `${version}\n`);
		return;
	}

	const wantsHelp = argv.includes('--help') || argv.includes('-h');
	if (wantsHelp) {
		const projectRoot = process.cwd();
		let cmds: Record<string, { name: string; description?: string }> = {};
		try {
			cmds = await discoverCommands(projectRoot);
		} catch {}
		printHelp(cmds);
		return;
	}

	if (cmd === 'sessions') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = (
			projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd()
		) as string;
		if (!(await ensureSomeAuth(projectRoot))) return;
		const json = argv.includes('--json');
		const listFlag = argv.includes('--list');
		const pick = !listFlag && !json ? true : argv.includes('--pick');
		const limitIdx = argv.indexOf('--limit');
		const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : undefined;
		await runSessions({ project: projectRoot, json, pick, limit });
		return;
	}

	if (cmd === 'models' || cmd === 'switch') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
		const local = argv.includes('--local');
		await runModels({ project: projectRoot, local });
		return;
	}

	if (cmd === 'agents') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
		const local = argv.includes('--local');
		await runAgents({ project: projectRoot, local });
		return;
	}

	if (cmd === 'scaffold' || cmd === 'generate') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
		const local = argv.includes('--local');
		await runScaffold({ project: projectRoot, local });
		return;
	}

	if (cmd === 'tools') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
		await runToolsList({ project: projectRoot });
		return;
	}

	if (cmd === 'doctor') {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
		await runDoctor({ project: projectRoot });
		return;
	}

	if (cmd === 'auth') {
		await runAuth(argv.slice(1));
		return;
	}

	if (cmd === 'setup') {
		await runAuth(['login']);
		return;
	}

	if (cmd === 'serve') {
		await handleServeCommand(argv.slice(1));
		return;
	}

	if (ASK_ALIASES.has(cmd)) {
		await handleAskCommand(argv.slice(1));
		return;
	}

	if (cmd && !cmd.startsWith('-')) {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = (
			projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd()
		) as string;
		if (await runDiscoveredCommand(cmd, argv.slice(1), projectRoot)) return;
	}

	await handleServeCommand(argv);
}

async function handleAskCommand(args: string[]) {
	const prompt = args.find((a) => !a.startsWith('-'));
	const agentIdx = args.indexOf('--agent');
	const providerIdx = args.indexOf('--provider');
	const modelIdx = args.indexOf('--model');
	const projectIdx = args.indexOf('--project');
	const lastFlag = args.includes('--last');
	const sessionIdx = args.indexOf('--session');

	const agent = agentIdx >= 0 ? args[agentIdx + 1] : undefined;
	const provider =
		providerIdx >= 0
			? (args[providerIdx + 1] as
					| 'openai'
					| 'anthropic'
					| 'google'
					| 'openrouter'
					| 'opencode'
					| 'solforge')
			: undefined;
	const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
	const project = projectIdx >= 0 ? args[projectIdx + 1] : undefined;
	const sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : undefined;

	const projectRoot = project ?? process.cwd();
	if (!(await ensureSomeAuth(projectRoot))) return;

	if (prompt) {
		await runAsk(prompt, {
			agent,
			provider,
			model,
			project,
			last: lastFlag,
			sessionId,
		});
		return;
	}

	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	intro('agi ask');
	const input = await text({ message: 'What would you like to ask?' });
	if (isCancel(input)) return cancel('Cancelled');
	const userPrompt = String(input ?? '').trim();
	if (!userPrompt) {
		outro('No input provided. Exiting.');
		return;
	}

	await runAsk(userPrompt, {
		project: projectRoot,
		agent,
		provider,
		model,
		last: lastFlag,
		sessionId,
	});
}

async function handleServeCommand(args: string[]) {
	const projectIdx = args.indexOf('--project');
	const projectRoot = (
		projectIdx >= 0 ? args[projectIdx + 1] : process.cwd()
	) as string;
	const noOpen = args.includes('--no-open');

	if (!(await ensureSomeAuth(projectRoot))) return;

	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const app = createApp();
	const portFlagIndex = args.indexOf('--port');
	const networkFlag = args.includes('--network');
	const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;

	const requestedPort =
		portFlagIndex >= 0 ? Number(args[portFlagIndex + 1]) : (portEnv ?? 0);

	const hostname = networkFlag ? '0.0.0.0' : 'localhost';

	const agiServer = Bun.serve({
		port: requestedPort,
		hostname,
		fetch: app.fetch,
		idleTimeout: 240,
	});

	const displayHost = networkFlag ? getLocalIP() : 'localhost';
	const apiUrl = `http://${displayHost}:${agiServer.port}`;

	const webPort = agiServer.port + 1;
	let webServer: ReturnType<typeof createWebServer>['server'] | null = null;
	let webUrl: string | null = null;
	try {
		const { port: actualWebPort, server } = createWebServer(
			webPort,
			agiServer.port,
			networkFlag,
		);
		webServer = server;
		webUrl = `http://${displayHost}:${actualWebPort}`;
	} catch (error) {
		logger.error('Failed to start Web UI server', error);
		console.log('   AGI server is still running without Web UI');
	}

	const version = (PKG as { version: string }).version;
	console.log('');
	console.log(colors.bold('  ⚡ AGI') + colors.dim(` v${version}`));
	console.log('');
	console.log(`  ${colors.dim('API')}     ${colors.cyan(apiUrl)}`);
	if (webUrl) {
		console.log(`  ${colors.dim('Web UI')}  ${colors.cyan(webUrl)}`);
	}
	if (networkFlag) {
		console.log('');
		console.log(
			colors.dim(`  Also accessible at http://localhost:${agiServer.port}`),
		);
	}
	console.log('');
	console.log(colors.dim('  Press Ctrl+C to stop'));
	console.log('');

	if (webUrl && !noOpen) {
		const opened = await openAuthUrl(webUrl);
		if (!opened) {
			console.log(colors.dim(`  Could not open browser automatically`));
		}
	}

	let shuttingDown = false;
	const shutdown = async (signal: NodeJS.Signals) => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`\nReceived ${signal}, shutting down...`);
		try {
			const terminalManager = getTerminalManager();
			if (terminalManager) {
				await terminalManager.killAll();
			}
		} catch (error) {
			logger.error('Error cleaning up terminals', error);
		}

		try {
			webServer?.stop(true);
		} catch (error) {
			logger.error('Error stopping web server', error);
		}

		try {
			agiServer.stop(true);
		} catch (error) {
			logger.error('Error stopping API server', error);
		}

		process.exit(0);
	};

	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
	logger.error('Unhandled Promise Rejection', reason);
	process.exit(1);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception', error);
	process.exit(1);
});

main();

function printHelp(
	discovered?: Record<string, { name: string; description?: string }>,
) {
	const lines = [
		'Usage: agi [command] [options]',
		'',
		'Commands:',
		'  (default)                          Start API server + Web UI',
		'  ask|run|do|a "<prompt>"            One-shot ask (or interactive if no prompt)',
		'  serve [--port <port>] [--network]  Explicit alias for default behavior',
		'  sessions [--list|--json]           Manage or pick sessions (default: pick)',
		'  auth <login|list|logout>           Manage provider credentials',
		'  setup                              Alias for `auth login`',
		'  models|switch                      Pick default provider/model (interactive)',
		'  scaffold|generate                  Create agents, tools, or commands (interactive)',
		'  agents [--local]                   Edit agents.json entries (interactive)',
		'  tools                              List discovered tools and agent access',
		'  doctor                             Diagnose auth, defaults, and agent/tool issues',
		'',
		'Ask options:',
		'  --agent <name>           Override agent',
		'  --provider <p>           Override provider (openai, anthropic, google, etc.)',
		'  --model <m>              Override model',
		'  --project <path>         Use project at <path> (default: cwd)',
		'  --last                   Continue most recent session',
		'  --session <id>           Continue specific session',
		'',
		'Server options:',
		'  --port <port>            Specify port (default: random)',
		'  --network                Bind to 0.0.0.0 for network access',
		'  --no-open                Do not open browser automatically',
		'',
		'Global options:',
		'  --debug                  Enable debug logging',
		'  --trace                  Enable stack traces in error logs',
		'  --version, -v            Print version and exit',
		'  --help, -h               Show this help',
	];
	if (discovered && Object.keys(discovered).length) {
		lines.push('', 'Project commands:');
		for (const c of Object.values(discovered))
			lines.push(`  ${c.name}  ${c.description ?? ''}`);
	}
	Bun.write(Bun.stdout, `${lines.join('\n')}\n`);
}

async function ensureSomeAuth(projectRoot: string): Promise<boolean> {
	let cfg = await loadConfig(projectRoot);
	const defaultProvider = cfg.defaults.provider as ProviderId;

	const checkAny = async (
		config: Awaited<ReturnType<typeof loadConfig>>,
	): Promise<boolean> => {
		const providers: ProviderId[] = [
			'openai',
			'anthropic',
			'google',
			'openrouter',
			'opencode',
			'solforge',
		];
		const statuses = await Promise.all(
			providers.map((provider) => isProviderAuthorized(config, provider)),
		);
		return statuses.some(Boolean);
	};

	// Check if already authorized (default provider or any provider)
	const defaultAuthorized = await isProviderAuthorized(cfg, defaultProvider);
	if (defaultAuthorized) return true;
	if (await checkAny(cfg)) return true;

	// No auth found - run interactive login flow
	const authSuccess = await runAuth(['login', defaultProvider]);
	if (!authSuccess) {
		// User cancelled or auth failed
		return false;
	}

	// Verify auth was saved
	cfg = await loadConfig(projectRoot);
	return (
		(await isProviderAuthorized(cfg, defaultProvider)) || (await checkAny(cfg))
	);
}

function getLocalIP(): string {
	try {
		const { networkInterfaces } = require('node:os');
		const nets = networkInterfaces();
		for (const name of Object.keys(nets)) {
			for (const net of nets[name]) {
				if (net.family === 'IPv4' && !net.internal) {
					return net.address;
				}
			}
		}
	} catch {}
	return '0.0.0.0';
}
