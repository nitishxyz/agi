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
			};
		});

		return c.json({ servers });
	});

	app.post('/v1/mcp/servers', async (c) => {
		const projectRoot = process.cwd();
		const body = await c.req.json();

		const { name, transport, command, args, env, url, headers, oauth } = body;
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
		if ((t === 'http' || t === 'sse') && !url) {
			return c.json(
				{ ok: false, error: 'url is required for http/sse transport' },
				400,
			);
		}

		const serverConfig = {
			name: String(name),
			transport: t,
			...(command ? { command: String(command) } : {}),
			...(Array.isArray(args) ? { args: args.map(String) } : {}),
			...(env && typeof env === 'object' ? { env } : {}),
			...(url ? { url: String(url) } : {}),
			...(headers && typeof headers === 'object' ? { headers } : {}),
			...(oauth && typeof oauth === 'object' ? { oauth } : {}),
		};

		try {
			await addMCPServerToConfig(projectRoot, serverConfig);
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
				await manager.stopServer(name);
			}

			const removed = await removeMCPServerFromConfig(projectRoot, name);
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
				manager = await initializeMCP({ servers: [] });
			}
			await manager.restartServer(serverConfig);
			const status = (await manager.getStatusAsync()).find(
				(s) => s.name === name,
			);
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

		try {
			let manager = getMCPManager();
			if (!manager) {
				manager = await initializeMCP({ servers: [] });
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
		const { code } = body;

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
