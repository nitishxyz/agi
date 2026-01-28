import type { Command } from 'commander';
import {
	loadConfig,
	getTerminalManager,
	openAuthUrl,
	logger,
} from '@agi-cli/sdk';
import { createApp as createServer } from '@agi-cli/server';
import { getDb } from '@agi-cli/database';
import { createWebServer } from '../web-server.ts';
import { colors } from '../ui.ts';

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

export interface ServeOptions {
	project: string;
	port?: number;
	network: boolean;
	noOpen: boolean;
}

export async function handleServe(opts: ServeOptions, version: string) {
	const projectRoot = opts.project;

	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const app = createServer();
	const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
	const requestedPort = opts.port ?? portEnv ?? 0;
	const hostname = opts.network ? '0.0.0.0' : 'localhost';

	const agiServer = Bun.serve({
		port: requestedPort,
		hostname,
		fetch: app.fetch,
		idleTimeout: 240,
	});

	const displayHost = opts.network ? getLocalIP() : 'localhost';
	const serverPort = agiServer.port ?? requestedPort;
	const apiUrl = `http://${displayHost}:${serverPort}`;

	const webPort = serverPort + 1;
	let webServer: ReturnType<typeof createWebServer>['server'] | null = null;
	let webUrl: string | null = null;
	try {
		const { port: actualWebPort, server } = createWebServer(
			webPort,
			serverPort,
			opts.network,
		);
		webServer = server;
		webUrl = `http://${displayHost}:${actualWebPort}`;
	} catch (error) {
		logger.error('Failed to start Web UI server', error);
		console.log('   AGI server is still running without Web UI');
	}

	console.log('');
	console.log(colors.bold('  ⚡ AGI') + colors.dim(` v${version}`));
	console.log('');
	console.log(`  ${colors.dim('API')}     ${colors.cyan(apiUrl)}`);
	if (webUrl) {
		console.log(`  ${colors.dim('Web UI')}  ${colors.cyan(webUrl)}`);
	}
	if (opts.network) {
		console.log('');
		console.log(
			colors.dim(`  Also accessible at http://localhost:${serverPort}`),
		);
	}
	console.log('');
	console.log(colors.dim('  Press Ctrl+C to stop'));
	console.log('');

	if (webUrl && !opts.noOpen) {
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

export function registerServeCommand(program: Command, version: string) {
	program
		.command('serve')
		.description('Start API server + Web UI')
		.option('-p, --port <port>', 'Port to listen on', (v) =>
			Number.parseInt(v, 10),
		)
		.option('--network', 'Bind to 0.0.0.0 for network access', false)
		.option('--no-open', 'Do not open browser automatically')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await handleServe(
				{
					project: opts.project,
					port: opts.port,
					network: opts.network,
					noOpen: !opts.open,
				},
				version,
			);
		});
}
