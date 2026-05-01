import type { Hono } from 'hono';
import {
	COPILOT_MCP_SCOPE,
	getMCPManager,
	getCopilotMCPOAuthKey,
	getStoredCopilotMCPToken,
	initializeMCP,
	isGitHubCopilotUrl,
	loadMCPConfig,
	getGlobalConfigDir,
	MCPClientWrapper,
	OAuthCredentialStore,
	addMCPServerToConfig,
	removeMCPServerFromConfig,
} from '@ottocode/sdk';
import { authorizeCopilot, pollForCopilotTokenOnce } from '@ottocode/sdk';
import { openApiRoute } from '../openapi/route.ts';

const copilotMCPOAuthStore = new OAuthCredentialStore();

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
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/mcp/servers',
			tags: ['mcp'],
			operationId: 'listMCPServers',
			summary: 'List configured MCP servers',
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									servers: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/MCPServer',
										},
									},
								},
								required: ['servers'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers',
			tags: ['mcp'],
			operationId: 'addMCPServer',
			summary: 'Add a new MCP server',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								name: {
									type: 'string',
								},
								transport: {
									type: 'string',
									enum: ['stdio', 'http', 'sse'],
									default: 'stdio',
								},
								command: {
									type: 'string',
								},
								args: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								env: {
									type: 'object',
									additionalProperties: {
										type: 'string',
									},
								},
								url: {
									type: 'string',
								},
								headers: {
									type: 'object',
									additionalProperties: {
										type: 'string',
									},
								},
								oauth: {
									type: 'object',
								},
								scope: {
									type: 'string',
									enum: ['global', 'project'],
									default: 'global',
								},
							},
							required: ['name'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const projectRoot = process.cwd();
			const body = await c.req.json();

			const {
				name,
				transport,
				command,
				args,
				env,
				url,
				headers,
				oauth,
				scope,
			} = body;
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/mcp/servers/{name}',
			tags: ['mcp'],
			operationId: 'removeMCPServer',
			summary: 'Remove an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
					return c.json(
						{ ok: false, error: `Server "${name}" not found` },
						404,
					);
				}
				return c.json({ ok: true, name });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return c.json({ ok: false, error: msg }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers/{name}/start',
			tags: ['mcp'],
			operationId: 'startMCPServer',
			summary: 'Start an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									name: {
										type: 'string',
									},
									connected: {
										type: 'boolean',
									},
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
											},
										},
									},
									authRequired: {
										type: 'boolean',
									},
									authType: {
										type: 'string',
									},
									sessionId: {
										type: 'string',
									},
									userCode: {
										type: 'string',
									},
									verificationUri: {
										type: 'string',
									},
									interval: {
										type: 'integer',
									},
									authUrl: {
										type: 'string',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
					const existingAuth = await getStoredCopilotMCPToken(
						copilotMCPOAuthStore,
						name,
						serverConfig.scope ?? 'global',
						projectRoot,
					);

					if (!existingAuth.token || existingAuth.needsReauth) {
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers/{name}/stop',
			tags: ['mcp'],
			operationId: 'stopMCPServer',
			summary: 'Stop an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers/{name}/auth',
			tags: ['mcp'],
			operationId: 'initiateMCPAuth',
			summary: 'Initiate auth for an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									name: {
										type: 'string',
									},
									authUrl: {
										type: 'string',
									},
									authType: {
										type: 'string',
									},
									authenticated: {
										type: 'boolean',
									},
									sessionId: {
										type: 'string',
									},
									userCode: {
										type: 'string',
									},
									verificationUri: {
										type: 'string',
									},
									interval: {
										type: 'integer',
									},
									message: {
										type: 'string',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const name = c.req.param('name');
			const projectRoot = process.cwd();
			const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
			const serverConfig = config.servers.find((s) => s.name === name);

			if (!serverConfig) {
				return c.json({ ok: false, error: `Server "${name}" not found` }, 404);
			}

			if (isGitHubCopilotUrl(serverConfig.url)) {
				try {
					const existingAuth = await getStoredCopilotMCPToken(
						copilotMCPOAuthStore,
						name,
						serverConfig.scope ?? 'global',
						projectRoot,
					);
					if (existingAuth.token && !existingAuth.needsReauth) {
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers/{name}/auth/callback',
			tags: ['mcp'],
			operationId: 'completeMCPAuth',
			summary: 'Complete MCP server auth callback',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								code: {
									type: 'string',
								},
								sessionId: {
									type: 'string',
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									status: {
										type: 'string',
										enum: ['complete', 'pending', 'error'],
									},
									name: {
										type: 'string',
									},
									connected: {
										type: 'boolean',
									},
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
											},
										},
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const name = c.req.param('name');
			const body = await c.req.json();
			const { code, sessionId } = body;

			if (sessionId) {
				const session = copilotMCPSessions.get(sessionId);
				if (!session || session.serverName !== name) {
					return c.json(
						{ ok: false, error: 'Session expired or invalid' },
						400,
					);
				}
				try {
					const result = await pollForCopilotTokenOnce(session.deviceCode);
					if (result.status === 'complete') {
						copilotMCPSessions.delete(sessionId);
						const projectRoot = process.cwd();
						const config = await loadMCPConfig(
							projectRoot,
							getGlobalConfigDir(),
						);
						const serverConfig = config.servers.find((s) => s.name === name);
						if (!serverConfig) {
							return c.json(
								{ ok: false, error: `Server "${name}" not found` },
								404,
							);
						}
						await copilotMCPOAuthStore.saveTokens(
							getCopilotMCPOAuthKey(
								name,
								serverConfig.scope ?? 'global',
								projectRoot,
							),
							{
								access_token: result.accessToken,
								scope: COPILOT_MCP_SCOPE,
							},
						);
						let mcpMgr = getMCPManager();
						if (!mcpMgr) {
							mcpMgr = await initializeMCP({ servers: [] }, projectRoot);
						}
						await mcpMgr.restartServer(serverConfig);
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/mcp/servers/{name}/auth/status',
			tags: ['mcp'],
			operationId: 'getMCPAuthStatus',
			summary: 'Get auth status for an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									authenticated: {
										type: 'boolean',
									},
									authType: {
										type: 'string',
									},
								},
								required: ['authenticated'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const name = c.req.param('name');
			const projectRoot = process.cwd();
			const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
			const serverConfig = config.servers.find((s) => s.name === name);

			if (serverConfig && isGitHubCopilotUrl(serverConfig.url)) {
				try {
					const auth = await getStoredCopilotMCPToken(
						copilotMCPOAuthStore,
						name,
						serverConfig.scope ?? 'global',
						projectRoot,
					);
					const authenticated = !!auth.token && !auth.needsReauth;
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/mcp/servers/{name}/auth',
			tags: ['mcp'],
			operationId: 'revokeMCPAuth',
			summary: 'Revoke auth for an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const name = c.req.param('name');
			const projectRoot = process.cwd();
			const config = await loadMCPConfig(projectRoot, getGlobalConfigDir());
			const serverConfig = config.servers.find((s) => s.name === name);

			if (serverConfig && isGitHubCopilotUrl(serverConfig.url)) {
				try {
					const key = getCopilotMCPOAuthKey(
						name,
						serverConfig.scope ?? 'global',
						projectRoot,
					);
					await copilotMCPOAuthStore.clearServer(key);
					if (key !== name) {
						await copilotMCPOAuthStore.clearServer(name);
					}
					const manager = getMCPManager();
					if (manager) {
						await manager.clearAuthData(
							name,
							serverConfig.scope ?? 'global',
							projectRoot,
						);
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
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/mcp/servers/{name}/test',
			tags: ['mcp'],
			operationId: 'testMCPServer',
			summary: 'Test connection to an MCP server',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'MCP server name',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									name: {
										type: 'string',
									},
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
											},
										},
									},
									error: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
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
		},
	);
}
