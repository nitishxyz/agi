import { MCPServerManager } from './server-manager.ts';
import type { MCPConfig, MCPServerConfig, MCPScope } from './types.ts';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

let globalMCPManager: MCPServerManager | null = null;

export function getMCPManager(): MCPServerManager | null {
	return globalMCPManager;
}

export async function initializeMCP(
	config: MCPConfig,
	projectRoot?: string,
): Promise<MCPServerManager> {
	if (globalMCPManager) {
		await globalMCPManager.stopAll();
	}
	globalMCPManager = new MCPServerManager();
	if (projectRoot) {
		globalMCPManager.setProjectRoot(projectRoot);
	}
	await globalMCPManager.startServers(config.servers);
	return globalMCPManager;
}

export async function shutdownMCP(): Promise<void> {
	if (globalMCPManager) {
		await globalMCPManager.stopAll();
		globalMCPManager = null;
	}
}

export async function loadMCPConfig(
	projectRoot: string,
	globalConfigDir?: string,
): Promise<MCPConfig> {
	const servers: MCPServerConfig[] = [];
	const seen = new Set<string>();

	const globalPath = globalConfigDir
		? join(globalConfigDir, 'config.json')
		: null;
	if (globalPath) {
		const globalServers = await readMCPServersFromFile(globalPath);
		for (const s of globalServers) {
			seen.add(s.name);
			servers.push({ ...s, scope: 'global' });
		}
	}

	const projectPath = join(projectRoot, '.otto', 'config.json');
	const projectServers = await readMCPServersFromFile(projectPath);
	for (const s of projectServers) {
		if (seen.has(s.name)) {
			const idx = servers.findIndex((existing) => existing.name === s.name);
			if (idx >= 0) servers[idx] = { ...s, scope: 'project' };
		} else {
			servers.push({ ...s, scope: 'project' });
		}
	}

	return { servers };
}

async function readMCPServersFromFile(
	filePath: string,
): Promise<MCPServerConfig[]> {
	try {
		const text = await fs.readFile(filePath, 'utf-8');
		const json = JSON.parse(text);
		if (!json?.mcp?.servers) return [];
		const raw = json.mcp.servers;
		if (!Array.isArray(raw)) return [];
		return raw.filter(
			(s: unknown): s is MCPServerConfig =>
				typeof s === 'object' &&
				s !== null &&
				typeof (s as MCPServerConfig).name === 'string' &&
				(typeof (s as MCPServerConfig).command === 'string' ||
					typeof (s as MCPServerConfig).url === 'string'),
		);
	} catch {
		return [];
	}
}

function resolveConfigPath(
	projectRoot: string,
	globalConfigDir: string | undefined,
	scope: MCPScope,
): string {
	if (scope === 'global' && globalConfigDir) {
		return join(globalConfigDir, 'config.json');
	}
	return join(projectRoot, '.otto', 'config.json');
}

async function ensureConfigDir(configPath: string): Promise<void> {
	const dir = configPath.replace(/[/\\][^/\\]+$/, '');
	await fs.mkdir(dir, { recursive: true });
}

export async function addMCPServerToConfig(
	projectRoot: string,
	server: MCPServerConfig,
	globalConfigDir?: string,
): Promise<void> {
	const scope: MCPScope = server.scope ?? 'global';
	const configPath = resolveConfigPath(projectRoot, globalConfigDir, scope);

	let json: Record<string, unknown> = {};
	try {
		const text = await fs.readFile(configPath, 'utf-8');
		json = JSON.parse(text);
	} catch {}

	if (!json.mcp) json.mcp = {};
	const mcp = json.mcp as Record<string, unknown>;
	if (!Array.isArray(mcp.servers)) mcp.servers = [];

	const servers = mcp.servers as MCPServerConfig[];
	const idx = servers.findIndex((s) => s.name === server.name);

	const { scope: _scope, ...serverWithoutScope } = server;
	if (idx >= 0) {
		servers[idx] = serverWithoutScope;
	} else {
		servers.push(serverWithoutScope);
	}

	await ensureConfigDir(configPath);
	await fs.writeFile(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
}

export async function removeMCPServerFromConfig(
	projectRoot: string,
	name: string,
	globalConfigDir?: string,
): Promise<boolean> {
	const paths = [
		...(globalConfigDir ? [join(globalConfigDir, 'config.json')] : []),
		join(projectRoot, '.otto', 'config.json'),
	];

	for (const configPath of paths) {
		let json: Record<string, unknown> = {};
		try {
			const text = await fs.readFile(configPath, 'utf-8');
			json = JSON.parse(text);
		} catch {
			continue;
		}

		const mcp = json.mcp as Record<string, unknown> | undefined;
		if (!mcp || !Array.isArray(mcp.servers)) continue;

		const servers = mcp.servers as MCPServerConfig[];
		const idx = servers.findIndex((s) => s.name === name);
		if (idx < 0) continue;

		servers.splice(idx, 1);
		await fs.writeFile(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
		return true;
	}

	return false;
}
