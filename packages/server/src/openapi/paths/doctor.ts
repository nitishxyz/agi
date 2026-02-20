import { errorResponse, projectQueryParam } from '../helpers';

export const doctorPaths = {
	'/v1/doctor': {
		get: {
			tags: ['config'],
			operationId: 'runDoctor',
			summary: 'Run diagnostics on the current configuration',
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
										items: {
											type: 'object',
											properties: {
												id: { type: 'string' },
												ok: { type: 'boolean' },
												configured: { type: 'boolean' },
												sources: {
													type: 'array',
													items: { type: 'string' },
												},
											},
											required: ['id', 'ok', 'configured', 'sources'],
										},
									},
									defaults: {
										type: 'object',
										properties: {
											agent: { type: 'string' },
											provider: { type: 'string' },
											model: { type: 'string' },
											providerAuthorized: {
												type: 'boolean',
											},
										},
										required: [
											'agent',
											'provider',
											'model',
											'providerAuthorized',
										],
									},
									agents: {
										type: 'object',
										properties: {
											globalPath: {
												type: 'string',
												nullable: true,
											},
											localPath: {
												type: 'string',
												nullable: true,
											},
											globalNames: {
												type: 'array',
												items: { type: 'string' },
											},
											localNames: {
												type: 'array',
												items: { type: 'string' },
											},
										},
										required: [
											'globalPath',
											'localPath',
											'globalNames',
											'localNames',
										],
									},
									tools: {
										type: 'object',
										properties: {
											defaultNames: {
												type: 'array',
												items: { type: 'string' },
											},
											globalPath: {
												type: 'string',
												nullable: true,
											},
											globalNames: {
												type: 'array',
												items: { type: 'string' },
											},
											localPath: {
												type: 'string',
												nullable: true,
											},
											localNames: {
												type: 'array',
												items: { type: 'string' },
											},
											effectiveNames: {
												type: 'array',
												items: { type: 'string' },
											},
										},
										required: [
											'defaultNames',
											'globalNames',
											'localNames',
											'effectiveNames',
										],
									},
									commands: {
										type: 'object',
										properties: {
											globalPath: {
												type: 'string',
												nullable: true,
											},
											globalNames: {
												type: 'array',
												items: { type: 'string' },
											},
											localPath: {
												type: 'string',
												nullable: true,
											},
											localNames: {
												type: 'array',
												items: { type: 'string' },
											},
										},
										required: ['globalNames', 'localNames'],
									},
									issues: {
										type: 'array',
										items: { type: 'string' },
									},
									suggestions: {
										type: 'array',
										items: { type: 'string' },
									},
									globalAuthPath: {
										type: 'string',
										nullable: true,
									},
								},
								required: [
									'providers',
									'defaults',
									'agents',
									'tools',
									'commands',
									'issues',
									'suggestions',
								],
							},
						},
					},
				},
				500: errorResponse(),
			},
		},
	},
} as const;
