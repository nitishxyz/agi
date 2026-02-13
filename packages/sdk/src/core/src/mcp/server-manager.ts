import { MCPClientWrapper, type MCPToolInfo } from './client.ts';
import type { MCPServerConfig, MCPServerStatus } from './types.ts';

type IndexedTool = {
	server: string;
	tool: MCPToolInfo;
};

export class MCPServerManager {
	private clients = new Map<string, MCPClientWrapper>();
	private toolsMap = new Map<string, IndexedTool>();
	private _started = false;

	get started(): boolean {
		return this._started;
	}

	async startServers(configs: MCPServerConfig[]): Promise<void> {
		await this.stopAll();

		for (const config of configs) {
			if (config.disabled) continue;

			const client = new MCPClientWrapper(config);
			try {
				await client.connect();
				this.clients.set(config.name, client);

				const tools = await client.listTools();
				for (const tool of tools) {
					const fullName = `${config.name}__${tool.name}`;
					this.toolsMap.set(fullName, { server: config.name, tool });
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`[mcp] Failed to start server "${config.name}": ${msg}`);
			}
		}
		this._started = true;
	}

	async stopAll(): Promise<void> {
		const disconnects = Array.from(this.clients.values()).map((c) =>
			c.disconnect().catch(() => {}),
		);
		await Promise.all(disconnects);
		this.clients.clear();
		this.toolsMap.clear();
		this._started = false;
	}

	getTools(): Array<{ name: string; server: string; tool: MCPToolInfo }> {
		return Array.from(this.toolsMap.entries()).map(
			([name, { server, tool }]) => ({
				name,
				server,
				tool,
			}),
		);
	}

	async callTool(
		fullName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const entry = this.toolsMap.get(fullName);
		if (!entry) throw new Error(`Unknown MCP tool: ${fullName}`);

		const client = this.clients.get(entry.server);
		if (!client) throw new Error(`MCP server not connected: ${entry.server}`);

		return client.callTool(entry.tool.name, args);
	}

	getStatus(): MCPServerStatus[] {
		const statuses: MCPServerStatus[] = [];
		for (const [name, client] of this.clients) {
			const tools = Array.from(this.toolsMap.entries())
				.filter(([, v]) => v.server === name)
				.map(([k]) => k);
			statuses.push({
				name,
				connected: client.connected,
				tools,
			});
		}
		return statuses;
	}

	getServerNames(): string[] {
		return Array.from(this.clients.keys());
	}

	isServerConnected(name: string): boolean {
		return this.clients.get(name)?.connected ?? false;
	}

	async restartServer(config: MCPServerConfig): Promise<void> {
		await this.stopServer(config.name);

		const client = new MCPClientWrapper(config);
		await client.connect();
		this.clients.set(config.name, client);

		const tools = await client.listTools();
		for (const tool of tools) {
			const fullName = `${config.name}__${tool.name}`;
			this.toolsMap.set(fullName, { server: config.name, tool });
		}
	}

	async stopServer(name: string): Promise<void> {
		const client = this.clients.get(name);
		if (client) {
			await client.disconnect().catch(() => {});
			this.clients.delete(name);
			for (const [key, val] of this.toolsMap) {
				if (val.server === name) this.toolsMap.delete(key);
			}
		}
	}
}
