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
		const statuses = manager?.getStatus() ?? [];

		const servers = config.servers.map((s) => {
			const status = statuses.find((st) => st.name === s.name);
			return {
				name: s.name,
				command: s.command,
				args: s.args ?? [],
				disabled: s.disabled ?? false,
				connected: status?.connected ?? false,
				tools: status?.tools ?? [],
			};
		});

		return c.json({ servers });
	});

	app.post('/v1/mcp/servers', async (c) => {
		const projectRoot = process.cwd();
		const body = await c.req.json();

		const { name, command, args, env } = body;
		if (!name || !command) {
			return c.json({ ok: false, error: 'name and command are required' }, 400);
		}

		const serverConfig = {
			name: String(name),
			command: String(command),
			args: Array.isArray(args) ? args.map(String) : [],
			env: env && typeof env === 'object' ? env : undefined,
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
			const status = manager.getStatus().find((s) => s.name === name);
			return c.json({
				ok: true,
				name,
				connected: status?.connected ?? false,
				tools: status?.tools ?? [],
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
