import type { Command } from 'commander';
import { openAuthUrl, logger } from '@ottocode/sdk';
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

export interface WebOptions {
	api: string;
	port?: number;
	network: boolean;
	noOpen: boolean;
}

export async function handleWeb(opts: WebOptions, version: string) {
	let apiUrl: URL;
	try {
		apiUrl = new URL(opts.api);
	} catch {
		console.error(`Invalid API URL: ${opts.api}`);
		process.exit(1);
	}

	try {
		await fetch(opts.api, { method: 'GET', signal: AbortSignal.timeout(3000) });
	} catch {
		console.log(colors.yellow(`  ⚠ API server at ${opts.api} is not responding`));
		console.log(colors.dim('    Starting web UI anyway — it will retry when the server comes up'));
	}

	const webPort = opts.port ?? 0;

	const { port: actualWebPort, server } = createWebServer(
		webPort,
		opts.api,
		opts.network,
	);

	const displayHost = opts.network ? getLocalIP() : 'localhost';
	const webUrl = `http://${displayHost}:${actualWebPort}`;

	console.log('');
	console.log(colors.bold('  ⚡ otto web') + colors.dim(` v${version}`));
	console.log('');
	console.log(`  ${colors.dim('Web UI')}  ${colors.cyan(webUrl)}`);
	console.log(`  ${colors.dim('API')}     ${colors.cyan(opts.api)}`);
	console.log('');
	console.log(colors.dim('  Press Ctrl+C to stop'));
	console.log('');

	if (!opts.noOpen) {
		await openAuthUrl(webUrl);
	}

	const shutdown = () => {
		server.stop(true);
		process.exit(0);
	};
	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);

	await new Promise(() => {});
}

export function registerWebCommand(program: Command, version: string) {
	program
		.command('web')
		.description('Start Web UI only, connected to a remote API server')
		.requiredOption('--api <url>', 'API server URL to connect to')
		.option('-p, --port <port>', 'Web UI port', (v) => parseInt(v, 10))
		.option('--network', 'Bind to 0.0.0.0 for network access', false)
		.option('--no-open', 'Do not open browser automatically')
		.action(async (opts) => {
			await handleWeb(
				{
					api: opts.api,
					port: opts.port,
					network: opts.network,
					noOpen: !opts.open,
				},
				version,
			);
		});
}
