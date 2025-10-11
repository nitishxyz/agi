import { loadConfig, isProviderAuthorized } from '@agi-cli/sdk';
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

const createApp = createServer;
// Load package version for --version flag (works in compiled binary)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PKG from './package.json' with { type: 'json' };

// Handle both compiled binaries and regular bun execution
let argv = process.argv.slice(2);

// In compiled binaries, sometimes the binary name appears in argv
// Remove it if the first argument is just "agi" (the binary name)
if (argv[0] === 'agi' || argv[0]?.endsWith('/agi')) {
	argv = argv.slice(1);
}

const cmd = argv[0];

async function main() {
	// Parse --debug and --trace flags early
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

	// Debug: Check what arguments we received (only in debug mode)
	if (debugEnabled) {
		console.log('DEBUG: process.argv:', process.argv);
		console.log('DEBUG: argv (after cleanup):', argv);
		console.log('DEBUG: cmd:', cmd);
	}

	// Global version/help (no auth required)
	const wantsVersion = argv.includes('--version') || argv.includes('-v');
	if (wantsVersion) {
		const version = (PKG as { version: string }).version;
		Bun.write(Bun.stdout, `${version}\n`);
		return;
	}

	// Global help (no auth required) with project command discovery
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
	if (cmd === 'serve') {
		// Ensure DB exists and migrations are applied before serving
		const projectRoot = process.cwd();
		if (!(await ensureSomeAuth(projectRoot))) return;
		const cfg = await loadConfig(projectRoot);
		await getDb(cfg.projectRoot);

		const app = createApp();
		const portFlagIndex = argv.indexOf('--port');
		const networkFlag = argv.includes('--network');
		const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;

		// Use explicit port if provided, otherwise use PORT env, otherwise use 0 (random)
		const requestedPort =
			portFlagIndex >= 0 ? Number(argv[portFlagIndex + 1]) : (portEnv ?? 0);

		// Determine hostname based on --network flag
		const hostname = networkFlag ? '0.0.0.0' : 'localhost';

		// Start the AGI server
		const agiServer = Bun.serve({
			port: requestedPort,
			hostname,
			fetch: app.fetch,
			idleTimeout: 240,
		});

		// Get display URL based on hostname
		const displayHost = networkFlag ? getLocalIP() : 'localhost';
		console.log(
			`🚀 agi server listening on http://${displayHost}:${agiServer.port}`,
		);
		if (networkFlag) {
			console.log(`   Also accessible at http://localhost:${agiServer.port}`);
		}

		// Start the Web UI server on the next port
		const webPort = agiServer.port + 1;
		try {
			const { port: actualWebPort } = createWebServer(
				webPort,
				agiServer.port,
				networkFlag,
			);
			console.log(
				`🌐 Web UI available at http://${displayHost}:${actualWebPort}`,
			);
			if (networkFlag) {
				console.log(`   Also accessible at http://localhost:${actualWebPort}`);
			}
		} catch (error) {
			console.error('❌ Failed to start Web UI server:', error);
			console.log('   AGI server is still running without Web UI');
		}

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
		// Default behavior: interactive pick unless --list or --json is provided
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

	// note: commit and other project commands are handled by discovered command dispatcher

	if (cmd === 'auth') {
		await runAuth(argv.slice(1));
		return;
	}

	if (cmd === 'setup') {
		// Setup is now just auth login
		await runAuth(['login']);
		return;
	}

	// Discovered commands from project manifests
	if (cmd && !cmd.startsWith('-')) {
		const projectIdx = argv.indexOf('--project');
		const projectRoot = (
			projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd()
		) as string;
		if (await runDiscoveredCommand(cmd, argv.slice(1), projectRoot)) return;
	}

	// One-shot: agi "<prompt>" [--agent] [--provider] [--model] [--project]
	if (cmd && !cmd.startsWith('-')) {
		if (debugEnabled) {
			console.log('DEBUG: Entering one-shot mode with cmd:', cmd);
		}
		const prompt = cmd;
		const agentIdx = argv.indexOf('--agent');
		const providerIdx = argv.indexOf('--provider');
		const modelIdx = argv.indexOf('--model');
		const projectIdx = argv.indexOf('--project');
		const lastFlag = argv.includes('--last');
		const sessionIdx = argv.indexOf('--session');
		const agent = agentIdx >= 0 ? argv[agentIdx + 1] : undefined;
		const provider =
			providerIdx >= 0
				? (argv[providerIdx + 1] as
						| 'openai'
						| 'anthropic'
						| 'google'
						| 'openrouter')
				: undefined;
		const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
		const project = projectIdx >= 0 ? argv[projectIdx + 1] : undefined;
		const sessionId = sessionIdx >= 0 ? argv[sessionIdx + 1] : undefined;
		if (!(await ensureSomeAuth(project ?? process.cwd()))) return;
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

	// No non-flag command provided: context-aware interactive mode
	// Respect flags like --project, --last, --session (and optionally agent/provider/model)
	if (debugEnabled) {
		console.log('DEBUG: Entering interactive mode - will prompt for input');
	}
	const projectIdx = argv.indexOf('--project');
	const projectRoot = (
		projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd()
	) as string;
	if (!(await ensureSomeAuth(projectRoot))) return;
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	// Prompt for input if none provided
	intro('agi');
	const input = await text({ message: 'What would you like to ask?' });
	if (isCancel(input)) return cancel('Cancelled');
	const prompt = String(input ?? '').trim();
	if (!prompt) {
		outro('No input provided. Exiting.');
		return;
	}
	const agentIdx = argv.indexOf('--agent');
	const providerIdx = argv.indexOf('--provider');
	const modelIdx = argv.indexOf('--model');
	const lastFlag = argv.includes('--last');
	const sessionIdx = argv.indexOf('--session');
	const agent = agentIdx >= 0 ? argv[agentIdx + 1] : undefined;
	const provider =
		providerIdx >= 0
			? (argv[providerIdx + 1] as
					| 'openai'
					| 'anthropic'
					| 'google'
					| 'openrouter')
			: undefined;
	const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
	const sessionId = sessionIdx >= 0 ? argv[sessionIdx + 1] : undefined;
	await runAsk(prompt, {
		project: projectRoot,
		agent,
		provider,
		model,
		last: lastFlag,
		sessionId,
	});
}

process.on('unhandledRejection', (reason, promise) => {
	console.error('\n[FATAL] Unhandled Promise Rejection:', reason);
	console.error('Promise:', promise);
	process.exit(1);
});

process.on('uncaughtException', (error) => {
	console.error('\n[FATAL] Uncaught Exception:', error);
	process.exit(1);
});

main();

function printHelp(
	discovered?: Record<string, { name: string; description?: string }>,
) {
	const lines = [
		'Usage: agi [command] [options] [prompt]',
		'',
		'Commands:',
		'  serve [--port <port>] [--network]  Start the HTTP server (AGI API + Web UI)',
		'  sessions [--list|--json]           Manage or pick sessions (default: pick)',
		'  auth <login|list|logout>           Manage provider credentials',
		'  setup                              Alias for `auth login`',
		'  models|switch                      Pick default provider/model (interactive)',
		'  scaffold|generate                  Create agents, tools, or commands (interactive)',
		'  agents [--local]                   Edit agents.json entries (interactive)',
		'  tools                              List discovered tools and agent access',
		'  doctor                             Diagnose auth, defaults, and agent/tool issues',
		'  chat [--last|--session]            Start an interactive chat (if enabled)',
		'',
		'One-shot ask:',
		'  agi "<prompt>" [--agent <name>] [--provider <p>] [--model <m>] [--project <path>] [--last|--session <id>]',
		'',
		'Common options:',
		'  --project <path>         Use project at <path> (default: cwd)',
		'  --last                   Send to most-recent session',
		'  --session <id>           Send to a specific session',
		'  --network                Bind to 0.0.0.0 for network access (serve only)',
		'  --debug                  Enable debug logging (errors, warnings, debug messages)',
		'  --trace                  Enable stack traces in error logs (requires --debug)',
		'  --json | --json-stream   Machine-readable outputs',
		'  --version, -v            Print version and exit',
	];
	if (discovered && Object.keys(discovered).length) {
		lines.push('', 'Project commands:');
		for (const c of Object.values(discovered))
			lines.push(`  ${c.name}  ${c.description ?? ''}`);
	}
	Bun.write(Bun.stdout, `${lines.join('\n')}\n`);
}

async function ensureSomeAuth(projectRoot: string): Promise<boolean> {
	const cfg = await loadConfig(projectRoot);
	const any = await Promise.all([
		isProviderAuthorized(cfg, 'openai'),
		isProviderAuthorized(cfg, 'anthropic'),
		isProviderAuthorized(cfg, 'google'),
		isProviderAuthorized(cfg, 'openrouter'),
	]).then((arr) => arr.some(Boolean));
	if (!any) {
		await runAuth(['login']);
		const cfg2 = await loadConfig(projectRoot);
		const any2 = await Promise.all([
			isProviderAuthorized(cfg2, 'openai'),
			isProviderAuthorized(cfg2, 'anthropic'),
			isProviderAuthorized(cfg2, 'google'),
			isProviderAuthorized(cfg2, 'openrouter'),
		]).then((arr) => arr.some(Boolean));
		return any2;
	}
	return true;
}

function getLocalIP(): string {
	try {
		const { networkInterfaces } = require('node:os');
		const nets = networkInterfaces();
		for (const name of Object.keys(nets)) {
			for (const net of nets[name]) {
				// Skip internal (loopback) and non-IPv4 addresses
				if (net.family === 'IPv4' && !net.internal) {
					return net.address;
				}
			}
		}
	} catch {
		// Fallback if we can't get the IP
	}
	return '0.0.0.0';
}
