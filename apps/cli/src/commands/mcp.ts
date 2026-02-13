import type { Command } from 'commander';
import {
	loadMCPConfig,
	initializeMCP,
	getGlobalConfigDir,
	type MCPServerConfig,
} from '@ottocode/sdk';
import { MCPClientWrapper } from '@ottocode/sdk';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

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
		.requiredOption('--command <cmd>', 'Command to run')
		.option('--args <args...>', 'Command arguments')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--global', 'Add to global config instead of project', false)
		.action(async (name, opts) => {
			await runMCPAdd(name, {
				project: opts.project,
				command: opts.command,
				args: opts.args,
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
}

async function runMCPList(opts: { project: string }) {
	const config = await loadMCPConfig(opts.project, getGlobalConfigDir());

	if (config.servers.length === 0) {
		console.log('No MCP servers configured.');
		console.log(
			'\nAdd servers to .otto/config.json or ~/.config/otto/config.json:',
		);
		console.log(
			JSON.stringify(
				{
					mcp: {
						servers: [
							{
								name: 'example',
								command: 'npx',
								args: ['-y', '@modelcontextprotocol/server-github'],
								env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
							},
						],
					},
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(`\nMCP Servers (${config.servers.length}):\n`);
	for (const server of config.servers) {
		const status = server.disabled ? ' (disabled)' : '';
		const args = server.args ? ` ${server.args.join(' ')}` : '';
		console.log(`  ${server.name}${status}`);
		console.log(`    command: ${server.command}${args}`);
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

	console.log(`Testing connection to "${name}"...`);
	console.log(
		`  command: ${serverConfig.command} ${(serverConfig.args ?? []).join(' ')}`,
	);

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
		console.error(`  status: failed ✗`);
		console.error(`  error: ${msg}`);
		process.exit(1);
	}
}

async function runMCPAdd(
	name: string,
	opts: {
		project: string;
		command: string;
		args?: string[];
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

	const existing = mcp.servers.findIndex((s) => s.name === name);
	const entry: MCPServerConfig = {
		name,
		command: opts.command,
		...(opts.args?.length ? { args: opts.args } : {}),
	};

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
