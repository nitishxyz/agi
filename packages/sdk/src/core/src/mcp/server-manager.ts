import { MCPClientWrapper, type MCPToolInfo } from './client.ts';
import type { MCPServerConfig, MCPServerStatus } from './types.ts';
import { OAuthCredentialStore } from './oauth/store.ts';
import { OttoOAuthProvider } from './oauth/provider.ts';
import { createHash } from 'node:crypto';
import { getAuth } from '../../../auth/src/index.ts';

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

const COPILOT_MCP_REQUIRED_SCOPES = [
	'repo',
	'read:org',
	'gist',
	'notifications',
	'read:project',
	'security_events',
];

function hasMCPScopes(scopes?: string): boolean {
	if (!scopes) return false;
	const granted = scopes.split(/[\s,]+/).filter(Boolean);
	return COPILOT_MCP_REQUIRED_SCOPES.every((s) => granted.includes(s));
}

async function getCopilotToken(): Promise<string | null> {
	try {
		const auth = await getAuth('copilot');
		if (auth?.type === 'oauth' && auth.refresh) {
			return auth.refresh;
		}
	} catch {}
	return null;
}

async function getCopilotMCPToken(): Promise<{
	token: string | null;
	needsReauth: boolean;
}> {
	try {
		const auth = await getAuth('copilot');
		if (auth?.type === 'oauth' && auth.refresh) {
			if (!hasMCPScopes(auth.scopes)) {
				return { token: auth.refresh, needsReauth: true };
			}
			return { token: auth.refresh, needsReauth: false };
		}
	} catch {}
	return { token: null, needsReauth: true };
}

type IndexedTool = {
	server: string;
	tool: MCPToolInfo;
};

export class MCPServerManager {
	private clients = new Map<string, MCPClientWrapper>();
	private toolsMap = new Map<string, IndexedTool>();
	private authProviders = new Map<string, OttoOAuthProvider>();
	private pendingAuth = new Map<string, string>();
	private oauthStore = new OAuthCredentialStore();
	private serverScopes = new Map<string, 'global' | 'project'>();
	private _started = false;
	private projectRoot: string | null = null;

	get started(): boolean {
		return this._started;
	}

	setProjectRoot(projectRoot: string): void {
		this.projectRoot = projectRoot;
	}

	private oauthKey(serverName: string): string {
		const scope = this.serverScopes.get(serverName);
		if (scope === 'project' && this.projectRoot) {
			const hash = createHash('sha256')
				.update(this.projectRoot)
				.digest('hex')
				.slice(0, 8);
			return `${serverName}_proj_${hash}`;
		}
		return serverName;
	}

	async startServers(configs: MCPServerConfig[]): Promise<void> {
		await this.stopAll();

		for (const config of configs) {
			if (config.disabled) continue;
			this.serverScopes.set(config.name, config.scope ?? 'global');
			await this.startSingleServer(config);
		}
		this._started = true;
	}

	private async startSingleServer(config: MCPServerConfig): Promise<void> {
		const client = new MCPClientWrapper(config);
		const transport = config.transport ?? 'stdio';

		if (transport !== 'stdio') {
			if (isGitHubCopilotUrl(config.url)) {
				const { token, needsReauth } = await getCopilotMCPToken();
				if (token && !needsReauth) {
					config = {
						...config,
						headers: {
							...config.headers,
							Authorization: `Bearer ${token}`,
						},
					};
					const updatedClient = new MCPClientWrapper(config);
					try {
						await updatedClient.connect();
						this.clients.set(config.name, updatedClient);
						const tools = await updatedClient.listTools();
						for (const tool of tools) {
							const fullName = `${config.name}__${tool.name}`;
							this.toolsMap.set(fullName, { server: config.name, tool });
						}
					} catch (err) {
						this.clients.set(config.name, updatedClient);
						const msg = err instanceof Error ? err.message : String(err);
						if (
							msg.includes('insufficient scopes') ||
							msg.includes('Forbidden')
						) {
							console.error(
								`[mcp] GitHub Copilot MCP server "${config.name}" has insufficient scopes. Run \`otto mcp auth ${config.name}\` to re-authenticate with required permissions.`,
							);
						} else {
							console.error(
								`[mcp] Failed to start server "${config.name}": ${msg}`,
							);
						}
					}
					return;
				}
				if (token && needsReauth) {
					console.error(
						`[mcp] GitHub Copilot MCP server "${config.name}" needs broader permissions. Run \`otto mcp auth ${config.name}\` to re-authenticate.`,
					);
					this.clients.set(config.name, client);
					return;
				}
				console.error(
					`[mcp] GitHub Copilot MCP server "${config.name}" requires authentication. Run \`otto auth login copilot\` or \`otto mcp auth ${config.name}\`.`,
				);
				this.clients.set(config.name, client);
				return;
			}

			const hasStaticAuth =
				config.headers?.Authorization || config.headers?.authorization;
			if (!hasStaticAuth) {
				const key = this.oauthKey(config.name);
				const provider = new OttoOAuthProvider(key, this.oauthStore, {
					clientId: config.oauth?.clientId,
					callbackPort: config.oauth?.callbackPort,
					scopes: config.oauth?.scopes,
				});
				client.setAuthProvider(provider);
				this.authProviders.set(config.name, provider);
			}
		}

		try {
			await client.connect();
			this.clients.set(config.name, client);

			const tools = await client.listTools();
			for (const tool of tools) {
				const fullName = `${config.name}__${tool.name}`;
				this.toolsMap.set(fullName, { server: config.name, tool });
			}
		} catch (err) {
			this.clients.set(config.name, client);

			if (client.authRequired) {
				const provider = this.authProviders.get(config.name);
				if (provider?.pendingAuthUrl) {
					this.pendingAuth.set(config.name, provider.pendingAuthUrl);
					this.waitForAuthAndReconnect(config.name, provider);
				}
				return;
			}

			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[mcp] Failed to start server "${config.name}": ${msg}`);
		}
	}

	private waitForAuthAndReconnect(
		name: string,
		provider: OttoOAuthProvider,
	): void {
		provider
			.waitForAuthCode()
			.then(async (code) => {
				console.log(`[mcp] Auth code received for "${name}", reconnecting...`);
				const success = await this.completeAuth(name, code);
				if (success) {
					console.log(`[mcp] Successfully authenticated "${name}"`);
				} else {
					console.error(`[mcp] Failed to complete auth for "${name}"`);
				}
			})
			.catch(() => {});
	}

	async stopAll(): Promise<void> {
		for (const provider of this.authProviders.values()) {
			provider.cleanup();
		}
		const disconnects = Array.from(this.clients.values()).map((c) =>
			c.disconnect().catch(() => {}),
		);
		await Promise.all(disconnects);
		this.clients.clear();
		this.toolsMap.clear();
		this.authProviders.clear();
		this.pendingAuth.clear();
		this.serverScopes.clear();
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
			const config = client.serverConfig;
			const key = this.oauthKey(name);
			const _authenticated = this.oauthStore
				.isAuthenticated(key)
				.catch(() => false);

			statuses.push({
				name,
				connected: client.connected,
				tools,
				transport: config.transport,
				url: config.url,
				authRequired: client.authRequired,
				authenticated: false,
			});
		}
		return statuses;
	}

	async getStatusAsync(): Promise<MCPServerStatus[]> {
		const statuses: MCPServerStatus[] = [];
		for (const [name, client] of this.clients) {
			const tools = Array.from(this.toolsMap.entries())
				.filter(([, v]) => v.server === name)
				.map(([k]) => k);
			const config = client.serverConfig;
			let authenticated = false;
			if (isGitHubCopilotUrl(config.url)) {
				authenticated = !!(await getCopilotToken());
			} else {
				const key = this.oauthKey(name);
				authenticated = await this.oauthStore
					.isAuthenticated(key)
					.catch(() => false);
			}

			statuses.push({
				name,
				connected: client.connected,
				tools,
				transport: config.transport,
				url: config.url,
				authRequired: client.authRequired,
				authenticated,
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

	getAuthUrl(name: string): string | null {
		return this.pendingAuth.get(name) ?? null;
	}

	async initiateAuth(config: MCPServerConfig): Promise<string | null> {
		const transport = config.transport ?? 'stdio';
		if (transport === 'stdio') return null;

		if (isGitHubCopilotUrl(config.url)) {
			const token = await getCopilotToken();
			if (token) {
				const authedConfig = {
					...config,
					headers: {
						...config.headers,
						Authorization: `Bearer ${token}`,
					},
				};
				const client = new MCPClientWrapper(authedConfig);
				try {
					await client.connect();
					this.clients.set(config.name, client);
					const tools = await client.listTools();
					for (const tool of tools) {
						const fullName = `${config.name}__${tool.name}`;
						this.toolsMap.set(fullName, { server: config.name, tool });
					}
				} catch (err) {
					this.clients.set(config.name, client);
					const msg = err instanceof Error ? err.message : String(err);
					console.error(
						`[mcp] Failed to start server "${config.name}": ${msg}`,
					);
				}
				return null;
			}
			return null;
		}

		this.serverScopes.set(config.name, config.scope ?? 'global');
		const key = this.oauthKey(config.name);
		await this.oauthStore.clearServer(key);
		const provider = new OttoOAuthProvider(key, this.oauthStore, {
			clientId: config.oauth?.clientId,
			callbackPort: config.oauth?.callbackPort,
			scopes: config.oauth?.scopes,
		});
		this.authProviders.set(config.name, provider);

		const client = new MCPClientWrapper(config);
		client.setAuthProvider(provider);

		try {
			await client.connect();
			this.clients.set(config.name, client);
			const tools = await client.listTools();
			for (const tool of tools) {
				const fullName = `${config.name}__${tool.name}`;
				this.toolsMap.set(fullName, { server: config.name, tool });
			}
			return null;
		} catch {
			this.clients.set(config.name, client);

			if (provider.pendingAuthUrl) {
				this.pendingAuth.set(config.name, provider.pendingAuthUrl);
				this.waitForAuthAndReconnect(config.name, provider);
				return provider.pendingAuthUrl;
			}
			return null;
		}
	}

	async completeAuth(name: string, code: string): Promise<boolean> {
		const client = this.clients.get(name);
		const provider = this.authProviders.get(name);
		if (!client || !provider) return false;

		try {
			await client.finishAuth(code);
			await client.disconnect();

			const config = client.serverConfig;
			const newClient = new MCPClientWrapper(config);
			newClient.setAuthProvider(provider);
			await newClient.connect();

			this.clients.set(name, newClient);

			const tools = await newClient.listTools();
			for (const [key, val] of this.toolsMap) {
				if (val.server === name) this.toolsMap.delete(key);
			}
			for (const tool of tools) {
				const fullName = `${name}__${tool.name}`;
				this.toolsMap.set(fullName, { server: name, tool });
			}

			this.pendingAuth.delete(name);
			provider.cleanup();
			return true;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[mcp] Failed to complete auth for "${name}": ${msg}`);
			return false;
		}
	}

	async revokeAuth(name: string): Promise<void> {
		const provider = this.authProviders.get(name);
		if (provider) {
			await provider.clearCredentials();
			provider.cleanup();
		}
		this.authProviders.delete(name);
		await this.stopServer(name);
	}

	async clearAuthData(
		name: string,
		scope?: 'global' | 'project',
		projectRoot?: string,
	): Promise<void> {
		const provider = this.authProviders.get(name);
		if (provider) {
			await provider.clearCredentials();
			provider.cleanup();
		}
		this.authProviders.delete(name);
		if (scope) {
			this.serverScopes.set(name, scope);
		}
		if (projectRoot) {
			this.projectRoot = projectRoot;
		}
		const key = this.oauthKey(name);
		await this.oauthStore.clearServer(key);
		if (key !== name) {
			await this.oauthStore.clearServer(name);
		}
	}

	async getAuthStatus(
		name: string,
	): Promise<{ authenticated: boolean; expiresAt?: number }> {
		const client = this.clients.get(name);
		if (client && isGitHubCopilotUrl(client.serverConfig.url)) {
			const token = await getCopilotToken();
			return { authenticated: !!token };
		}
		const key = this.oauthKey(name);
		const tokens = await this.oauthStore.loadTokens(key);
		if (!tokens?.access_token) return { authenticated: false };
		return {
			authenticated: true,
			expiresAt: tokens.expires_at,
		};
	}

	async restartServer(config: MCPServerConfig): Promise<void> {
		await this.stopServer(config.name);
		this.serverScopes.set(config.name, config.scope ?? 'global');
		await this.startSingleServer(config);
	}

	async stopServer(name: string): Promise<void> {
		const provider = this.authProviders.get(name);
		if (provider) {
			provider.cleanup();
			this.authProviders.delete(name);
		}
		const client = this.clients.get(name);
		if (client) {
			await client.disconnect().catch(() => {});
			this.clients.delete(name);
			for (const [key, val] of this.toolsMap) {
				if (val.server === name) this.toolsMap.delete(key);
			}
		}
		this.pendingAuth.delete(name);
	}
}
