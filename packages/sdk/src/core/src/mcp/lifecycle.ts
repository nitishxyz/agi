import { MCPServerManager } from './server-manager.ts';
import type { MCPConfig, MCPServerConfig } from './types.ts';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

let globalMCPManager: MCPServerManager | null = null;

export function getMCPManager(): MCPServerManager | null {
	return globalMCPManager;
}

export async function initializeMCP(
	config: MCPConfig,
): Promise<MCPServerManager> {
	if (globalMCPManager) {
		await globalMCPManager.stopAll();
	}
	globalMCPManager = new MCPServerManager();
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
			servers.push(s);
		}
	}

	const projectPath = join(projectRoot, '.otto', 'config.json');
	const projectServers = await readMCPServersFromFile(projectPath);
	for (const s of projectServers) {
		if (seen.has(s.name)) {
			const idx = servers.findIndex((existing) => existing.name === s.name);
			if (idx >= 0) servers[idx] = s;
		} else {
			servers.push(s);
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
				typeof (s as MCPServerConfig).command === 'string',
		);
	} catch {
		return [];
	}
}

export async function addMCPServerToConfig(
	projectRoot: string,
	server: MCPServerConfig,
): Promise<void> {
	const configPath = join(projectRoot, '.otto', 'config.json');
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
	if (idx >= 0) {
		servers[idx] = server;
	} else {
		servers.push(server);
	}

	await fs.mkdir(join(projectRoot, '.otto'), { recursive: true });
	await fs.writeFile(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
}

export async function removeMCPServerFromConfig(
	projectRoot: string,
	name: string,
): Promise<boolean> {
	const configPath = join(projectRoot, '.otto', 'config.json');
	let json: Record<string, unknown> = {};
	try {
		const text = await fs.readFile(configPath, 'utf-8');
		json = JSON.parse(text);
	} catch {
		return false;
	}

	const mcp = json.mcp as Record<string, unknown> | undefined;
	if (!mcp || !Array.isArray(mcp.servers)) return false;

	const servers = mcp.servers as MCPServerConfig[];
	const idx = servers.findIndex((s) => s.name === name);
	if (idx < 0) return false;

	servers.splice(idx, 1);
	await fs.writeFile(configPath, JSON.stringify(json, null, '\t'), 'utf-8');
	return true;
}
