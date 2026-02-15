import type { Hono } from 'hono';
import {
	getMCPManager,
	initializeMCP,
	loadMCPConfig,
	getGlobalConfigDir,
	MCPClientWrapper,
	addMCPServerToConfig,
	removeMCPServerFromConfig,
} from '@ottocode/sdk';
import {
	authorizeCopilot,
	pollForCopilotTokenOnce,
	getAuth,
	setAuth,
} from '@ottocode/sdk';

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

const copilotMCPSessions = new Map<
	string,
	{
		deviceCode: string;
		interval: number;
		serverName: string;
		createdAt: number;
	}
>();

export function registerMCPRoutes(app: Hono) {
	app.get('/v1/mcp/servers', async (c) => {
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const manager = getMCPManager();
		const statuses = manager ? await manager.getStatusAsync() : [];

		const servers = config.servers.map((s) => {
			const status = statuses.find((st) => st.name === s.name);
			return {
				name: s.name,
				transport: s.transport ?? 'stdio',
				command: s.command,
				args: s.args ?? [],
				url: s.url,
				disabled: s.disabled ?? false,
				connected: status?.connected ?? false,
				tools: status?.tools ?? [],
				authRequired: status?.authRequired ?? false,
				authenticated: status?.authenticated ?? false,
				scope: s.scope ?? 'global',
				...(isGitHubCopilotUrl(s.url) ? { authType: 'copilot-device' } : {}),
			};
		});

		return c.json({ servers });
	});

	app.post('/v1/mcp/servers', async (c) => {
		const projectRoot = process.cwd();
		const body = await c.req.json();

		const { name, transport, command, args, env, url, headers, oauth, scope } =
			body;
		if (!name) {
			return c.json({ ok: false, error: 'name is required' }, 400);
		}

		const t = transport ?? 'stdio';
		if (t === 'stdio' && !command) {
			return c.json(
				{ ok: false, error: 'command is required for stdio transport' },
				400,
			);
		}
		if (t === 'stdio' && command && /^https?:\/\//i.test(String(command))) {
			return c.json(
				{
					ok: false,
					error:
						'stdio transport requires a local command, not a URL. Use http or sse transport for remote servers.',
				},
				400,
			);
		}
		if ((t === 'http' || t === 'sse') && !url) {
			return c.json(
				{ ok: false, error: 'url is required for http/sse transport' },
				400,
			);
		}

		const serverScope = scope === 'project' ? 'project' : 'global';

		const serverConfig = {
			name: String(name),
			transport: t,
			scope: serverScope as 'global' | 'project',
			...(command ? { command: String(command) } : {}),
			...(Array.isArray(args) ? { args: args.map(String) } : {}),
			...(env && typeof env === 'object' ? { env } : {}),
			...(url ? { url: String(url) } : {}),
			...(headers && typeof headers === 'object' ? { headers } : {}),
			...(oauth && typeof oauth === 'object' ? { oauth } : {}),
		};

		try {
			await addMCPServerToConfig(
				projectRoot,
				serverConfig,
				getGlobalConfigDir(),
			);
			return c.json({ ok: true, server: serverConfig });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.delete('/v1/mcp/servers/:name', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();

		try {
			const manager = getMCPManager();
			if (manager) {
				const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
				const serverConfig = config.servers.find((s) => s.name === name);
				const scope = serverConfig?.scope ?? 'global';
				await manager.clearAuthData(name, scope, projectRoot);
				await manager.stopServer(name);
			}

			const removed = await removeMCPServerFromConfig(
				projectRoot,
				name,
				getGlobalConfigDir(),
			);
			if (!removed) {
				return c.json({ ok: false, error: `Server "${name}" not found` }, 404);
			}
			return c.json({ ok: true, name });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.post('/v1/mcp/servers/:name/start', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const serverConfig = config.servers.find((s) => s.name === name);

		if (!serverConfig) {
			return c.json({ ok: false, error: `Server "${name}" not found` }, 404);
		}

		try {
			let manager = getMCPManager();
			if (!manager) {
				manager = await initializeMCP({ servers: [] }, projectRoot);
			}
			if (!manager.started) {
				manager.setProjectRoot(projectRoot);
			}
			await manager.restartServer(serverConfig);
			const status = (await manager.getStatusAsync()).find(
				(s) => s.name === name,
			);

			if (isGitHubCopilotUrl(serverConfig.url) && !status?.connected) {
				const MCP_SCOPES =
					'repo read:org read:packages gist notifications read:project security_events';
				const existingAuth = await getAuth('copilot');
				const hasMCPScopes =
					existingAuth?.type === 'oauth' && existingAuth.scopes === MCP_SCOPES;

				if (!existingAuth || existingAuth.type !== 'oauth' || !hasMCPScopes) {
					const deviceData = await authorizeCopilot({ mcp: true });
					const sessionId = crypto.randomUUID();
					copilotMCPSessions.set(sessionId, {
						deviceCode: deviceData.deviceCode,
						interval: deviceData.interval,
						serverName: name,
						createdAt: Date.now(),
					});
					return c.json({
						ok: true,
						name,
						connected: false,
						authRequired: true,
						authType: 'copilot-device',
						sessionId,
						userCode: deviceData.userCode,
						verificationUri: deviceData.verificationUri,
						interval: deviceData.interval,
					});
				}
			}

			return c.json({
				ok: true,
				name,
				connected: status?.connected ?? false,
				tools: status?.tools ?? [],
				authRequired: status?.authRequired ?? false,
				authUrl: manager.getAuthUrl(name),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.post('/v1/mcp/servers/:name/stop', async (c) => {
		const name = c.req.param('name');
		const manager = getMCPManager();

		if (!manager) {
			return c.json({ ok: false, error: 'No MCP manager active' }, 400);
		}

		try {
			await manager.stopServer(name);
			return c.json({ ok: true, name, connected: false });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.post('/v1/mcp/servers/:name/auth', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const serverConfig = config.servers.find((s) => s.name === name);

		if (!serverConfig) {
			return c.json({ ok: false, error: `Server "${name}" not found` }, 404);
		}

		if (isGitHubCopilotUrl(serverConfig.url)) {
			try {
				const MCP_SCOPES =
					'repo read:org read:packages gist notifications read:project security_events';
				const existingAuth = await getAuth('copilot');
				if (
					existingAuth?.type === 'oauth' &&
					existingAuth.refresh &&
					existingAuth.scopes === MCP_SCOPES
				) {
					return c.json({
						ok: true,
						name,
						authType: 'copilot-device',
						authenticated: true,
						message: 'Already authenticated with MCP scopes',
					});
				}

				const deviceData = await authorizeCopilot({ mcp: true });
				const sessionId = crypto.randomUUID();
				copilotMCPSessions.set(sessionId, {
					deviceCode: deviceData.deviceCode,
					interval: deviceData.interval,
					serverName: name,
					createdAt: Date.now(),
				});
				return c.json({
					ok: true,
					name,
					authType: 'copilot-device',
					sessionId,
					userCode: deviceData.userCode,
					verificationUri: deviceData.verificationUri,
					interval: deviceData.interval,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return c.json({ ok: false, error: msg }, 500);
			}
		}

		try {
			let manager = getMCPManager();
			if (!manager) {
				manager = await initializeMCP({ servers: [] }, projectRoot);
			}
			if (!manager.started) {
				manager.setProjectRoot(projectRoot);
			}

			const authUrl = await manager.initiateAuth(serverConfig);
			if (authUrl) {
				return c.json({ ok: true, authUrl, name });
			}
			return c.json({
				ok: true,
				name,
				message: 'Already authenticated or no auth required',
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.post('/v1/mcp/servers/:name/auth/callback', async (c) => {
		const name = c.req.param('name');
		const body = await c.req.json();
		const { code, sessionId } = body;

		if (sessionId) {
			const session = copilotMCPSessions.get(sessionId);
			if (!session || session.serverName !== name) {
				return c.json({ ok: false, error: 'Session expired or invalid' }, 400);
			}
			try {
				const result = await pollForCopilotTokenOnce(session.deviceCode);
				if (result.status === 'complete') {
					copilotMCPSessions.delete(sessionId);
					await setAuth(
						'copilot',
						{
							type: 'oauth',
							refresh: result.accessToken,
							access: result.accessToken,
							expires: 0,
							scopes:
								'repo read:org read:packages gist notifications read:project security_events',
						},
						undefined,
						'global',
					);
					const projectRoot = process.cwd();
					const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
					const serverConfig = config.servers.find((s) => s.name === name);
					let mcpMgr = getMCPManager();
					if (serverConfig) {
						if (!mcpMgr) {
							mcpMgr = await initializeMCP({ servers: [] }, projectRoot);
						}
						await mcpMgr.restartServer(serverConfig);
					}
					mcpMgr = getMCPManager();
					const status = mcpMgr
						? (await mcpMgr.getStatusAsync()).find((s) => s.name === name)
						: undefined;
					return c.json({
						ok: true,
						status: 'complete',
						name,
						connected: status?.connected ?? false,
						tools: status?.tools ?? [],
					});
				}
				if (result.status === 'pending') {
					return c.json({ ok: true, status: 'pending' });
				}
				copilotMCPSessions.delete(sessionId);
				return c.json({
					ok: false,
					status: 'error',
					error: result.status === 'error' ? result.error : 'Unknown error',
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return c.json({ ok: false, error: msg }, 500);
			}
		}

		if (!code) {
			return c.json({ ok: false, error: 'code is required' }, 400);
		}

		const manager = getMCPManager();
		if (!manager) {
			return c.json({ ok: false, error: 'No MCP manager active' }, 400);
		}

		try {
			const success = await manager.completeAuth(name, String(code));
			if (success) {
				const status = (await manager.getStatusAsync()).find(
					(s) => s.name === name,
				);
				return c.json({
					ok: true,
					name,
					connected: status?.connected ?? false,
					tools: status?.tools ?? [],
				});
			}
			return c.json({ ok: false, error: 'Auth completion failed' }, 500);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.get('/v1/mcp/servers/:name/auth/status', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const serverConfig = config.servers.find((s) => s.name === name);

		if (serverConfig && isGitHubCopilotUrl(serverConfig.url)) {
			try {
				const auth = await getAuth('copilot');
				const authenticated = auth?.type === 'oauth' && !!auth.refresh;
				return c.json({ authenticated, authType: 'copilot-device' });
			} catch {
				return c.json({ authenticated: false, authType: 'copilot-device' });
			}
		}

		const manager = getMCPManager();
		if (!manager) {
			return c.json({ authenticated: false });
		}

		try {
			const status = await manager.getAuthStatus(name);
			return c.json(status);
		} catch {
			return c.json({ authenticated: false });
		}
	});

	app.delete('/v1/mcp/servers/:name/auth', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const serverConfig = config.servers.find((s) => s.name === name);

		if (serverConfig && isGitHubCopilotUrl(serverConfig.url)) {
			try {
				const { removeAuth } = await import('@ottocode/sdk');
				await removeAuth('copilot');
				const manager = getMCPManager();
				if (manager) {
					await manager.stopServer(name);
				}
				return c.json({ ok: true, name });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return c.json({ ok: false, error: msg }, 500);
			}
		}

		const manager = getMCPManager();
		if (!manager) {
			return c.json({ ok: false, error: 'No MCP manager active' }, 400);
		}

		try {
			await manager.revokeAuth(name);
			return c.json({ ok: true, name });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});

	app.post('/v1/mcp/servers/:name/test', async (c) => {
		const name = c.req.param('name');
		const projectRoot = process.cwd();
		const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
		const serverConfig = config.servers.find((s) => s.name === name);

		if (!serverConfig) {
			return c.json({ ok: false, error: `Server "${name}" not found` }, 404);
		}

		const client = new MCPClientWrapper(serverConfig);
		try {
			await client.connect();
			const tools = await client.listTools();
			await client.disconnect();
			return c.json({
				ok: true,
				name,
				tools: tools.map((t) => ({
					name: t.name,
					description: t.description,
				})),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return c.json({ ok: false, error: msg }, 500);
		}
	});
}
