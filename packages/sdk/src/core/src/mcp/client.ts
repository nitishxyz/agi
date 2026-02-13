import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { MCPServerConfig } from './types.ts';

export type MCPToolInfo = {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
};

export class MCPClientWrapper {
	private client: Client;
	private transport: Transport | null = null;
	private config: MCPServerConfig;
	private _connected = false;
	private _authRequired = false;
	private _authProvider: OAuthClientProvider | null = null;
	private _authUrl: string | null = null;

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

	get authRequired(): boolean {
		return this._authRequired;
	}

	get authUrl(): string | null {
		return this._authUrl;
	}

	get serverConfig(): MCPServerConfig {
		return this.config;
	}

	setAuthProvider(provider: OAuthClientProvider): void {
		this._authProvider = provider;
	}

	async connect(): Promise<void> {
		const transport = this.config.transport ?? 'stdio';

		switch (transport) {
			case 'stdio':
				await this.connectStdio();
				break;
			case 'http':
				await this.connectHTTP();
				break;
			case 'sse':
				await this.connectSSE();
				break;
			default:
				throw new Error(`Unknown transport: ${transport}`);
		}
	}

	private async connectStdio(): Promise<void> {
		if (!this.config.command) {
			throw new Error('command is required for stdio transport');
		}

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

	private async connectHTTP(): Promise<void> {
		if (!this.config.url) {
			throw new Error('url is required for http transport');
		}

		const url = new URL(this.config.url);
		const headers = this.resolveHeaders(this.config.headers ?? {});

		try {
			this.transport = new StreamableHTTPClientTransport(url, {
				authProvider: this._authProvider ?? undefined,
				requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
			});

			await this.client.connect(this.transport);
			this._connected = true;
			this._authRequired = false;
		} catch (err) {
			if (err instanceof UnauthorizedError) {
				this._authRequired = true;
				throw err;
			}
			throw err;
		}
	}

	private async connectSSE(): Promise<void> {
		if (!this.config.url) {
			throw new Error('url is required for sse transport');
		}

		const url = new URL(this.config.url);
		const headers = this.resolveHeaders(this.config.headers ?? {});

		try {
			this.transport = new SSEClientTransport(url, {
				authProvider: this._authProvider ?? undefined,
				requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
			});

			await this.client.connect(this.transport);
			this._connected = true;
			this._authRequired = false;
		} catch (err) {
			if (err instanceof UnauthorizedError) {
				this._authRequired = true;
				throw err;
			}
			throw err;
		}
	}

	async finishAuth(authorizationCode: string): Promise<void> {
		const transport = this.transport as
			| StreamableHTTPClientTransport
			| SSEClientTransport
			| null;
		if (transport && 'finishAuth' in transport) {
			await transport.finishAuth(authorizationCode);
		}
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

	private resolveHeaders(
		headers: Record<string, string>,
	): Record<string, string> {
		const resolved: Record<string, string> = {};
		for (const [key, value] of Object.entries(headers)) {
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
