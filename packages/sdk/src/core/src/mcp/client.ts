import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig } from './types.ts';

export type MCPToolInfo = {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
};

export class MCPClientWrapper {
	private client: Client;
	private transport: StdioClientTransport | null = null;
	private config: MCPServerConfig;
	private _connected = false;

	constructor(config: MCPServerConfig) {
		this.config = config;
		this.client = new Client(
			{ name: 'ottocode', version: '1.0.0' },
			{ capabilities: {} },
		);
	}

	get connected(): boolean {
		return this._connected;
	}

	get name(): string {
		return this.config.name;
	}

	async connect(): Promise<void> {
		const env = this.resolveEnv(this.config.env ?? {});
		this.transport = new StdioClientTransport({
			command: this.config.command,
			args: this.config.args,
			env: { ...process.env, ...env } as Record<string, string>,
			cwd: this.config.cwd,
			stderr: 'pipe',
		});

		await this.client.connect(this.transport);
		this._connected = true;
	}

	async listTools(): Promise<MCPToolInfo[]> {
		const result = await this.client.listTools();
		return (result.tools ?? []).map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema as Record<string, unknown>,
		}));
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const result = await this.client.callTool({ name, arguments: args });
		if (result.isError) {
			return {
				ok: false,
				error: formatContent(result.content),
			};
		}
		return {
			ok: true,
			result: formatContent(result.content),
		};
	}

	async disconnect(): Promise<void> {
		this._connected = false;
		try {
			await this.transport?.close();
		} catch {}
		this.transport = null;
	}

	private resolveEnv(env: Record<string, string>): Record<string, string> {
		const resolved: Record<string, string> = {};
		for (const [key, value] of Object.entries(env)) {
			resolved[key] = value.replace(
				/\$\{(\w+)\}/g,
				(_, name) => process.env[name] ?? '',
			);
		}
		return resolved;
	}
}

function formatContent(content: unknown): string {
	if (!Array.isArray(content)) return String(content ?? '');
	const parts: string[] = [];
	for (const item of content) {
		if (item && typeof item === 'object' && 'text' in item) {
			parts.push(String(item.text));
		} else if (item && typeof item === 'object' && 'data' in item) {
			parts.push(
				`[binary data: ${(item as { mimeType?: string }).mimeType ?? 'unknown'}]`,
			);
		} else {
			parts.push(JSON.stringify(item));
		}
	}
	return parts.join('\n');
}
