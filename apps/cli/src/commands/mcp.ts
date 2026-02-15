import type { Command } from 'commander';
import {
	loadMCPConfig,
	initializeMCP,
	getGlobalConfigDir,
	type MCPServerConfig,
	OAuthCredentialStore,
	OttoOAuthProvider,
	OAuthCallbackServer,
} from '@ottocode/sdk';
import { MCPClientWrapper } from '@ottocode/sdk';
import {
	authorizeCopilot,
	pollForCopilotToken,
	openCopilotAuthUrl,
} from '@ottocode/sdk';
import { getAuth, setAuth } from '@ottocode/sdk';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';

const GITHUB_COPILOT_HOSTS = [
	'api.githubcopilot.com',
	'copilot-proxy.githubusercontent.com',
];

function isGitHubCopilotUrl(url?: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		return GITHUB_COPILOT_HOSTS.some(
			(h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
		);
	} catch {
		return false;
	}
}

export function registerMCPCommand(program: Command) {
	const mcp = program
		.command('mcp')
		.description('Manage MCP (Model Context Protocol) servers');

	mcp
		.command('list', { isDefault: true })
		.description('List configured MCP servers')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await runMCPList({ project: opts.project });
		});

	mcp
		.command('status')
		.description('Show running MCP servers and their tools')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (opts) => {
			await runMCPStatus({ project: opts.project });
		});

	mcp
		.command('test <name>')
		.description('Test connection to an MCP server')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (name, opts) => {
			await runMCPTest(name, { project: opts.project });
		});

	mcp
		.command('add <name>')
		.description('Add an MCP server to project config')
		.option('--command <cmd>', 'Command to run (for stdio)')
		.option('--args <args...>', 'Command arguments')
		.option('--transport <type>', 'Transport type: stdio, http, sse', 'stdio')
		.option('--url <url>', 'Server URL (for http/sse)')
		.option('--header <headers...>', 'Headers (Key: Value)')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--global', 'Add to global config instead of project', false)
		.action(async (name, opts) => {
			await runMCPAdd(name, {
				project: opts.project,
				transport: opts.transport,
				command: opts.command,
				args: opts.args,
				url: opts.url,
				headers: opts.header,
				global: opts.global,
			});
		});

	mcp
		.command('remove <name>')
		.description('Remove an MCP server from config')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--global', 'Remove from global config', false)
		.action(async (name, opts) => {
			await runMCPRemove(name, {
				project: opts.project,
				global: opts.global,
			});
		});

	mcp
		.command('auth <name>')
		.description('Authenticate with an OAuth MCP server')
		.option('--revoke', 'Revoke stored credentials', false)
		.option('--status', 'Show auth status', false)
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.action(async (name, opts) => {
			await runMCPAuth(name, {
				project: opts.project,
				revoke: opts.revoke,
				status: opts.status,
			});
		});
}

async function runMCPList(opts: { project: string }) {
	const config = await loadMCPConfig(opts.project, getGlobalConfigDir());

	if (config.servers.length === 0) {
		console.log('No MCP servers configured.');
		return;
	}

	console.log(`\nMCP Servers (${config.servers.length}):\n`);
	for (const server of config.servers) {
		const transport = server.transport ?? 'stdio';
		const status = server.disabled ? ' (disabled)' : '';
		console.log(`  ${server.name} [${transport}]${status}`);
		if (transport === 'stdio') {
			const args = server.args ? ` ${server.args.join(' ')}` : '';
			console.log(`    command: ${server.command}${args}`);
		} else {
			console.log(`    url: ${server.url}`);
		}
		if (server.env) {
			const envKeys = Object.keys(server.env);
			if (envKeys.length > 0) {
				console.log(`    env: ${envKeys.join(', ')}`);
			}
		}
		console.log();
	}
}

async function runMCPStatus(opts: { project: string }) {
	const config = await loadMCPConfig(opts.project, getGlobalConfigDir());

	if (config.servers.length === 0) {
		console.log('No MCP servers configured.');
		return;
	}

	console.log('\nConnecting to MCP servers...\n');
	const manager = await initializeMCP(config);
	const statuses = manager.getStatus();

	for (const status of statuses) {
		const icon = status.connected ? '●' : '○';
		console.log(
			`  ${icon} ${status.name} (${status.connected ? 'connected' : 'disconnected'})`,
		);
		if (status.tools.length > 0) {
			console.log(`    tools: ${status.tools.join(', ')}`);
		}
		if (status.error) {
			console.log(`    error: ${status.error}`);
		}
	}

	await manager.stopAll();
}

async function runMCPTest(name: string, opts: { project: string }) {
	const config = await loadMCPConfig(opts.project, getGlobalConfigDir());
	const serverConfig = config.servers.find((s) => s.name === name);

	if (!serverConfig) {
		console.error(`MCP server "${name}" not found in config.`);
		process.exit(1);
	}

	const transport = serverConfig.transport ?? 'stdio';
	console.log(`Testing connection to "${name}" [${transport}]...`);

	const client = new MCPClientWrapper(serverConfig);
	try {
		await client.connect();
		console.log('  status: connected ✓');

		const tools = await client.listTools();
		console.log(`  tools (${tools.length}):`);
		for (const t of tools) {
			console.log(`    - ${t.name}: ${t.description ?? '(no description)'}`);
		}

		await client.disconnect();
		console.log('\nServer test passed ✓');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('  status: failed ✗');
		console.error(`  error: ${msg}`);
		process.exit(1);
	}
}

async function runMCPAdd(
	name: string,
	opts: {
		project: string;
		transport: string;
		command?: string;
		args?: string[];
		url?: string;
		headers?: string[];
		global: boolean;
	},
) {
	const configPath = opts.global
		? join(getGlobalConfigDir(), 'config.json')
		: join(opts.project, '.otto', 'config.json');

	let config: Record<string, unknown> = {};
	try {
		const text = await fs.readFile(configPath, 'utf-8');
		config = JSON.parse(text);
	} catch {}

	if (!config.mcp || typeof config.mcp !== 'object') {
		config.mcp = { servers: [] };
	}
	const mcp = config.mcp as { servers: MCPServerConfig[] };
	if (!Array.isArray(mcp.servers)) {
		mcp.servers = [];
	}

	const t = opts.transport ?? 'stdio';

	if (t === 'stdio' && !opts.command) {
		console.error('--command is required for stdio transport');
		process.exit(1);
	}
	if ((t === 'http' || t === 'sse') && !opts.url) {
		console.error('--url is required for http/sse transport');
		process.exit(1);
	}

	let headers: Record<string, string> | undefined;
	if (opts.headers?.length) {
		headers = {};
		for (const h of opts.headers) {
			const colon = h.indexOf(':');
			if (colon > 0) {
				headers[h.slice(0, colon).trim()] = h.slice(colon + 1).trim();
			}
		}
	}

	const entry: MCPServerConfig = {
		name,
		transport: t as MCPServerConfig['transport'],
		...(opts.command ? { command: opts.command } : {}),
		...(opts.args?.length ? { args: opts.args } : {}),
		...(opts.url ? { url: opts.url } : {}),
		...(headers ? { headers } : {}),
	};

	const existing = mcp.servers.findIndex((s) => s.name === name);
	if (existing >= 0) {
		mcp.servers[existing] = entry;
		console.log(`Updated MCP server "${name}" in ${configPath}`);
	} else {
		mcp.servers.push(entry);
		console.log(`Added MCP server "${name}" to ${configPath}`);
	}

	await fs.mkdir(join(configPath, '..'), { recursive: true });
	await fs.writeFile(configPath, JSON.stringify(config, null, '\t'), 'utf-8');
}

async function runMCPRemove(
	name: string,
	opts: { project: string; global: boolean },
) {
	const configPath = opts.global
		? join(getGlobalConfigDir(), 'config.json')
		: join(opts.project, '.otto', 'config.json');

	let config: Record<string, unknown> = {};
	try {
		const text = await fs.readFile(configPath, 'utf-8');
		config = JSON.parse(text);
	} catch {
		console.error(`Config file not found: ${configPath}`);
		process.exit(1);
	}

	const mcp = config.mcp as { servers: MCPServerConfig[] } | undefined;
	if (!mcp?.servers?.length) {
		console.error(`No MCP servers in ${configPath}`);
		process.exit(1);
	}

	const idx = mcp.servers.findIndex((s) => s.name === name);
	if (idx < 0) {
		console.error(`MCP server "${name}" not found in ${configPath}`);
		process.exit(1);
	}

	mcp.servers.splice(idx, 1);
	await fs.writeFile(configPath, JSON.stringify(config, null, '\t'), 'utf-8');
	console.log(`Removed MCP server "${name}" from ${configPath}`);
}

async function runMCPAuth(
	name: string,
	opts: { project: string; revoke: boolean; status: boolean },
) {
	const config = await loadMCPConfig(opts.project, getGlobalConfigDir());
	const serverConfig = config.servers.find((s) => s.name === name);

	if (!serverConfig) {
		console.error(`MCP server "${name}" not found in config.`);
		process.exit(1);
	}

	const transport = serverConfig.transport ?? 'stdio';
	if (transport === 'stdio') {
		console.error(
			`Server "${name}" uses stdio transport, OAuth not applicable.`,
		);
		process.exit(1);
	}

	if (isGitHubCopilotUrl(serverConfig.url)) {
		await runCopilotMCPAuth(name, serverConfig, opts);
		return;
	}

	const store = new OAuthCredentialStore();
	if (opts.status) {
		const authenticated = await store.isAuthenticated(name);
		const tokens = await store.loadTokens(name);
		console.log(`\nAuth status for "${name}":`);
		console.log(`  authenticated: ${authenticated ? 'yes' : 'no'}`);
		if (tokens?.expires_at) {
			const expiresIn = tokens.expires_at - Math.floor(Date.now() / 1000);
			if (expiresIn > 0) {
				console.log(`  expires in: ${Math.floor(expiresIn / 60)} minutes`);
			} else {
				console.log('  token: expired');
			}
		}
		return;
	}

	if (opts.revoke) {
		await store.clearServer(name);
		console.log(`Revoked credentials for "${name}".`);
		return;
	}

	const callbackPort = serverConfig.oauth?.callbackPort ?? 8090;
	const provider = new OttoOAuthProvider(name, store, {
		clientId: serverConfig.oauth?.clientId,
		callbackPort,
		scopes: serverConfig.oauth?.scopes,
	});

	const client = new MCPClientWrapper(serverConfig);
	client.setAuthProvider(provider);

	console.log(`\nAuthenticating "${name}"...`);

	try {
		await client.connect();
		console.log('Already authenticated. Connected successfully ✓');
		const tools = await client.listTools();
		console.log(`  ${tools.length} tools available`);
		await client.disconnect();
	} catch {
		if (provider.pendingAuthUrl) {
			console.log(`\n🔐 Opening browser for authorization...`);
			console.log(`   ${provider.pendingAuthUrl}`);
			openBrowser(provider.pendingAuthUrl);

			console.log(
				`⏳ Waiting for callback on http://localhost:${callbackPort}/callback...`,
			);

			try {
				const callbackServer = new OAuthCallbackServer(callbackPort);
				const result = await callbackServer.waitForCallback();
				console.log('✅ Authorization code received!');

				await client.finishAuth(result.code);
				await client.disconnect();

				const newClient = new MCPClientWrapper(serverConfig);
				newClient.setAuthProvider(provider);
				await newClient.connect();
				const tools = await newClient.listTools();
				console.log(`✅ Authenticated! ${tools.length} tools available.`);
				await newClient.disconnect();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`\n✗ Auth failed: ${msg}`);
				process.exit(1);
			}
		} else {
			console.error('Server did not provide an auth URL.');
			process.exit(1);
		}
	} finally {
		provider.cleanup();
	}
}

function openBrowser(url: string) {
	const platform = process.platform;
	const cmd =
		platform === 'darwin'
			? `open "${url}"`
			: platform === 'win32'
				? `start "${url}"`
				: `xdg-open "${url}"`;

	exec(cmd, (err) => {
		if (err) {
			console.log(`  Please open manually: ${url}`);
		}
	});
}

async function runCopilotMCPAuth(
	name: string,
	serverConfig: MCPServerConfig,
	opts: { project: string; revoke: boolean; status: boolean },
) {
	if (opts.status) {
		const auth = await getAuth('copilot');
		const authenticated = auth?.type === 'oauth' && !!auth.refresh;
		const scopes = (auth?.type === 'oauth' && auth.scopes) || 'none';
		console.log(`\nAuth status for "${name}" (GitHub Copilot):`);
		console.log(`  authenticated: ${authenticated ? 'yes' : 'no'}`);
		console.log(`  scopes: ${scopes}`);
		return;
	}

	if (opts.revoke) {
		const { removeAuth } = await import('@ottocode/sdk');
		await removeAuth('copilot');
		console.log(`Revoked Copilot credentials for "${name}".`);
		return;
	}

	const MCP_SCOPES =
		'repo read:org read:packages gist notifications read:project security_events';
	const existingAuth = await getAuth('copilot');
	if (
		existingAuth?.type === 'oauth' &&
		existingAuth.refresh &&
		existingAuth.scopes === MCP_SCOPES
	) {
		const client = new MCPClientWrapper({
			...serverConfig,
			headers: {
				...serverConfig.headers,
				Authorization: `Bearer ${existingAuth.refresh}`,
			},
		});
		try {
			await client.connect();
			const tools = await client.listTools();
			console.log(
				`Already authenticated with MCP scopes. ${tools.length} tools available ✓`,
			);
			await client.disconnect();
			return;
		} catch {
			console.log(
				'Existing token invalid or insufficient, re-authenticating...',
			);
		}
	} else if (existingAuth?.type === 'oauth' && existingAuth.refresh) {
		console.log(
			'Existing token lacks MCP scopes, re-authenticating with broader permissions...',
		);
	}

	console.log('\n🔐 Starting GitHub Copilot device flow (MCP scopes)...');
	const deviceData = await authorizeCopilot({ mcp: true });

	console.log(`\nOpen: ${deviceData.verificationUri}`);
	console.log(`Enter code: ${deviceData.userCode}\n`);

	await openCopilotAuthUrl(deviceData.verificationUri);

	console.log('⏳ Waiting for authorization...');

	try {
		const accessToken = await pollForCopilotToken(
			deviceData.deviceCode,
			deviceData.interval,
		);

		await setAuth('copilot', {
			type: 'oauth',
			refresh: accessToken,
			access: accessToken,
			expires: 0,
			scopes: MCP_SCOPES,
		});

		const client = new MCPClientWrapper({
			...serverConfig,
			headers: {
				...serverConfig.headers,
				Authorization: `Bearer ${accessToken}`,
			},
		});
		await client.connect();
		const tools = await client.listTools();
		console.log(`✅ Authenticated! ${tools.length} tools available.`);
		await client.disconnect();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`\n✗ Auth failed: ${msg}`);
		process.exit(1);
	}
}
