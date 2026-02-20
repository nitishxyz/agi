import { projectQueryParam } from '../helpers';

export const configPaths = {
	'/v1/config': {
		get: {
			tags: ['config'],
			operationId: 'getConfig',
			summary: 'Get full configuration',
			description: 'Returns agents, authorized providers, models, and defaults',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Config' },
						},
					},
				},
			},
		},
	},
	'/v1/config/cwd': {
		get: {
			tags: ['config'],
			operationId: 'getCwd',
			summary: 'Get current working directory info',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									cwd: { type: 'string' },
									dirName: { type: 'string' },
								},
								required: ['cwd', 'dirName'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/config/agents': {
		get: {
			tags: ['config'],
			operationId: 'getAgents',
			summary: 'Get available agents',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									agents: {
										type: 'array',
										items: { type: 'string' },
									},
									default: { type: 'string' },
								},
								required: ['agents', 'default'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/config/providers': {
		get: {
			tags: ['config'],
			operationId: 'getProviders',
			summary: 'Get available providers',
			description: 'Returns only providers that have been authorized',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									providers: {
										type: 'array',
										items: { $ref: '#/components/schemas/Provider' },
									},
									default: { $ref: '#/components/schemas/Provider' },
								},
								required: ['providers', 'default'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/config/providers/{provider}/models': {
		get: {
			tags: ['config'],
			operationId: 'getProviderModels',
			summary: 'Get available models for a provider',
			parameters: [
				projectQueryParam(),
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { $ref: '#/components/schemas/Provider' },
				},
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									models: {
										type: 'array',
										items: { $ref: '#/components/schemas/Model' },
									},
									default: { type: 'string', nullable: true },
								},
								required: ['models'],
							},
						},
					},
				},
				403: {
					description: 'Provider not authorized',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { error: { type: 'string' } },
								required: ['error'],
							},
						},
					},
				},
				404: {
					description: 'Provider not found',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { error: { type: 'string' } },
								required: ['error'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/config/defaults': {
		patch: {
			tags: ['config'],
			operationId: 'updateDefaults',
			summary: 'Update default configuration',
			description: 'Update the default agent, provider, and/or model',
			parameters: [projectQueryParam()],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								agent: { type: 'string' },
								provider: { type: 'string' },
								model: { type: 'string' },
								scope: {
									type: 'string',
									enum: ['global', 'local'],
									default: 'local',
								},
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
									success: { type: 'boolean' },
									defaults: {
										type: 'object',
										properties: {
											agent: { type: 'string' },
											provider: { type: 'string' },
											model: { type: 'string' },
										},
										required: ['agent', 'provider', 'model'],
									},
								},
								required: ['success', 'defaults'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/config/models': {
		get: {
			tags: ['config'],
			operationId: 'getAllModels',
			summary: 'Get all models across authorized providers',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								additionalProperties: {
									type: 'object',
									properties: {
										label: { type: 'string' },
										authType: { type: 'string' },
										models: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													id: { type: 'string' },
													label: { type: 'string' },
													toolCall: { type: 'boolean' },
													reasoningText: { type: 'boolean' },
													vision: { type: 'boolean' },
													attachment: { type: 'boolean' },
												},
												required: ['id', 'label'],
											},
										},
									},
									required: ['label', 'models'],
								},
							},
						},
					},
				},
			},
		},
	},
} as const;
