import { errorResponse } from '../helpers';

const nameParam = {
	in: 'path',
	name: 'name',
	required: true,
	schema: { type: 'string' },
	description: 'MCP server name',
} as const;

const okErrorSchema = {
	type: 'object',
	properties: {
		ok: { type: 'boolean' },
		error: { type: 'string' },
	},
	required: ['ok'],
} as const;

export const mcpPaths = {
	'/v1/mcp/servers': {
		get: {
			tags: ['mcp'],
			operationId: 'listMCPServers',
			summary: 'List configured MCP servers',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									servers: {
										type: 'array',
										items: { $ref: '#/components/schemas/MCPServer' },
									},
								},
								required: ['servers'],
							},
						},
					},
				},
			},
		},
		post: {
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
								name: { type: 'string' },
								transport: {
									type: 'string',
									enum: ['stdio', 'http', 'sse'],
									default: 'stdio',
								},
								command: { type: 'string' },
								args: {
									type: 'array',
									items: { type: 'string' },
								},
								env: {
									type: 'object',
									additionalProperties: { type: 'string' },
								},
								url: { type: 'string' },
								headers: {
									type: 'object',
									additionalProperties: { type: 'string' },
								},
								oauth: { type: 'object' },
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
				200: {
					description: 'OK',
					content: { 'application/json': { schema: okErrorSchema } },
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}': {
		delete: {
			tags: ['mcp'],
			operationId: 'removeMCPServer',
			summary: 'Remove an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: { 'application/json': { schema: okErrorSchema } },
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}/start': {
		post: {
			tags: ['mcp'],
			operationId: 'startMCPServer',
			summary: 'Start an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									name: { type: 'string' },
									connected: { type: 'boolean' },
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: { type: 'string' },
												description: { type: 'string' },
											},
										},
									},
									authRequired: { type: 'boolean' },
									authType: { type: 'string' },
									sessionId: { type: 'string' },
									userCode: { type: 'string' },
									verificationUri: { type: 'string' },
									interval: { type: 'integer' },
									authUrl: { type: 'string' },
									error: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}/stop': {
		post: {
			tags: ['mcp'],
			operationId: 'stopMCPServer',
			summary: 'Stop an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: { 'application/json': { schema: okErrorSchema } },
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}/auth': {
		post: {
			tags: ['mcp'],
			operationId: 'initiateMCPAuth',
			summary: 'Initiate auth for an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									name: { type: 'string' },
									authUrl: { type: 'string' },
									authType: { type: 'string' },
									authenticated: { type: 'boolean' },
									sessionId: { type: 'string' },
									userCode: { type: 'string' },
									verificationUri: { type: 'string' },
									interval: { type: 'integer' },
									message: { type: 'string' },
									error: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
		delete: {
			tags: ['mcp'],
			operationId: 'revokeMCPAuth',
			summary: 'Revoke auth for an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: { 'application/json': { schema: okErrorSchema } },
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}/auth/callback': {
		post: {
			tags: ['mcp'],
			operationId: 'completeMCPAuth',
			summary: 'Complete MCP server auth callback',
			parameters: [nameParam],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								code: { type: 'string' },
								sessionId: { type: 'string' },
							},
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									status: {
										type: 'string',
										enum: ['complete', 'pending', 'error'],
									},
									name: { type: 'string' },
									connected: { type: 'boolean' },
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: { type: 'string' },
												description: { type: 'string' },
											},
										},
									},
									error: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/mcp/servers/{name}/auth/status': {
		get: {
			tags: ['mcp'],
			operationId: 'getMCPAuthStatus',
			summary: 'Get auth status for an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									authenticated: { type: 'boolean' },
									authType: { type: 'string' },
								},
								required: ['authenticated'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/mcp/servers/{name}/test': {
		post: {
			tags: ['mcp'],
			operationId: 'testMCPServer',
			summary: 'Test connection to an MCP server',
			parameters: [nameParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									name: { type: 'string' },
									tools: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: { type: 'string' },
												description: { type: 'string' },
											},
										},
									},
									error: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
} as const;
