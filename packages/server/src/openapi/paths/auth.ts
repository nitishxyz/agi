import { errorResponse } from '../helpers';

export const authPaths = {
	'/v1/auth/status': {
		get: {
			tags: ['auth'],
			operationId: 'getAuthStatus',
			summary: 'Get auth status for all providers',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									onboardingComplete: { type: 'boolean' },
									ottorouter: {
										type: 'object',
										properties: {
											configured: { type: 'boolean' },
											publicKey: { type: 'string' },
										},
										required: ['configured'],
									},
									providers: {
										type: 'object',
										additionalProperties: {
											type: 'object',
											properties: {
												configured: { type: 'boolean' },
												type: {
													type: 'string',
													enum: ['api', 'oauth', 'wallet'],
												},
												label: { type: 'string' },
												supportsOAuth: { type: 'boolean' },
												supportsToken: { type: 'boolean' },
												supportsGhImport: { type: 'boolean' },
												modelCount: { type: 'integer' },
												costRange: {
													type: 'object',
													nullable: true,
													properties: {
														min: { type: 'number' },
														max: { type: 'number' },
													},
													required: ['min', 'max'],
												},
											},
											required: [
												'configured',
												'label',
												'supportsOAuth',
												'modelCount',
											],
										},
									},
									defaults: {
										type: 'object',
										properties: {
											agent: { type: 'string' },
											provider: { type: 'string' },
											model: { type: 'string' },
										},
									},
								},
								required: ['onboardingComplete', 'ottorouter', 'providers'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/auth/ottorouter/setup': {
		post: {
			tags: ['auth'],
			operationId: 'setupOttoRouterWallet',
			summary: 'Setup or ensure OttoRouter wallet',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: { type: 'boolean' },
									publicKey: { type: 'string' },
									isNew: { type: 'boolean' },
								},
								required: ['success', 'publicKey', 'isNew'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/auth/ottorouter/import': {
		post: {
			tags: ['auth'],
			operationId: 'importOttoRouterWallet',
			summary: 'Import OttoRouter wallet from private key',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								privateKey: { type: 'string' },
							},
							required: ['privateKey'],
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
									publicKey: { type: 'string' },
								},
								required: ['success', 'publicKey'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/ottorouter/export': {
		get: {
			tags: ['auth'],
			operationId: 'exportOttoRouterWallet',
			summary: 'Export OttoRouter wallet private key',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: { type: 'boolean' },
									publicKey: { type: 'string' },
									privateKey: { type: 'string' },
								},
								required: ['success', 'publicKey', 'privateKey'],
							},
						},
					},
				},
				404: errorResponse(),
			},
		},
	},
	'/v1/auth/{provider}': {
		post: {
			tags: ['auth'],
			operationId: 'addProviderApiKey',
			summary: 'Add API key for a provider',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								apiKey: { type: 'string' },
							},
							required: ['apiKey'],
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
									provider: { type: 'string' },
								},
								required: ['success', 'provider'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
		delete: {
			tags: ['auth'],
			operationId: 'removeProvider',
			summary: 'Remove auth for a provider',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
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
									success: { type: 'boolean' },
									provider: { type: 'string' },
								},
								required: ['success', 'provider'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/{provider}/oauth/url': {
		post: {
			tags: ['auth'],
			operationId: 'getOAuthUrl',
			summary: 'Get OAuth authorization URL',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
				},
			],
			requestBody: {
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								mode: {
									type: 'string',
									enum: ['max', 'console'],
									default: 'max',
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
									url: { type: 'string' },
									sessionId: { type: 'string' },
									provider: { type: 'string' },
								},
								required: ['url', 'sessionId', 'provider'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/{provider}/oauth/exchange': {
		post: {
			tags: ['auth'],
			operationId: 'exchangeOAuthCode',
			summary: 'Exchange OAuth code for tokens',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
				},
			],
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
							required: ['code', 'sessionId'],
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
									provider: { type: 'string' },
								},
								required: ['success', 'provider'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/{provider}/oauth/start': {
		get: {
			tags: ['auth'],
			operationId: 'startOAuth',
			summary: 'Start OAuth flow with redirect',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
				},
				{
					in: 'query',
					name: 'mode',
					required: false,
					schema: {
						type: 'string',
						enum: ['max', 'console'],
						default: 'max',
					},
				},
			],
			responses: {
				302: { description: 'Redirect to OAuth provider' },
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/{provider}/oauth/callback': {
		get: {
			tags: ['auth'],
			operationId: 'oauthCallback',
			summary: 'OAuth callback handler',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string' },
				},
				{
					in: 'query',
					name: 'code',
					required: false,
					schema: { type: 'string' },
				},
				{
					in: 'query',
					name: 'fragment',
					required: false,
					schema: { type: 'string' },
				},
			],
			responses: {
				200: {
					description: 'HTML response',
					content: { 'text/html': { schema: { type: 'string' } } },
				},
			},
		},
	},
	'/v1/auth/copilot/device/start': {
		post: {
			tags: ['auth'],
			operationId: 'startCopilotDeviceFlow',
			summary: 'Start Copilot device flow authentication',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									sessionId: { type: 'string' },
									userCode: { type: 'string' },
									verificationUri: { type: 'string' },
									interval: { type: 'integer' },
								},
								required: [
									'sessionId',
									'userCode',
									'verificationUri',
									'interval',
								],
							},
						},
					},
				},
			},
		},
	},
	'/v1/auth/copilot/device/poll': {
		post: {
			tags: ['auth'],
			operationId: 'pollCopilotDeviceFlow',
			summary: 'Poll Copilot device flow for completion',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								sessionId: { type: 'string' },
							},
							required: ['sessionId'],
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
									status: {
										type: 'string',
										enum: ['complete', 'pending', 'error'],
									},
									error: { type: 'string' },
								},
								required: ['status'],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/copilot/methods': {
		get: {
			tags: ['auth'],
			operationId: 'getCopilotAuthMethods',
			summary: 'Get available Copilot auth methods',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									oauth: { type: 'boolean' },
									token: { type: 'boolean' },
									ghImport: {
										type: 'object',
										properties: {
											available: { type: 'boolean' },
											authenticated: { type: 'boolean' },
											reason: { type: 'string' },
										},
										required: ['available', 'authenticated'],
									},
								},
								required: ['oauth', 'token', 'ghImport'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/auth/copilot/token': {
		post: {
			tags: ['auth'],
			operationId: 'saveCopilotToken',
			summary: 'Save Copilot token after validating model access',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								token: { type: 'string' },
							},
							required: ['token'],
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
									provider: { type: 'string' },
									source: { type: 'string', enum: ['token'] },
									modelCount: { type: 'integer' },
									hasGpt52Codex: { type: 'boolean' },
									sampleModels: {
										type: 'array',
										items: { type: 'string' },
									},
								},
								required: [
									'success',
									'provider',
									'source',
									'modelCount',
									'hasGpt52Codex',
									'sampleModels',
								],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/copilot/gh/import': {
		post: {
			tags: ['auth'],
			operationId: 'importCopilotTokenFromGh',
			summary: 'Import Copilot token from GitHub CLI (gh)',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: { type: 'boolean' },
									provider: { type: 'string' },
									source: { type: 'string', enum: ['gh'] },
									modelCount: { type: 'integer' },
									hasGpt52Codex: { type: 'boolean' },
									sampleModels: {
										type: 'array',
										items: { type: 'string' },
									},
								},
								required: [
									'success',
									'provider',
									'source',
									'modelCount',
									'hasGpt52Codex',
									'sampleModels',
								],
							},
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
	'/v1/auth/copilot/diagnostics': {
		get: {
			tags: ['auth'],
			operationId: 'getCopilotDiagnostics',
			summary: 'Get Copilot token diagnostics and model visibility',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									tokenSources: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												source: {
													type: 'string',
													enum: ['env', 'stored'],
												},
												configured: { type: 'boolean' },
												modelCount: { type: 'integer' },
												hasGpt52Codex: { type: 'boolean' },
												sampleModels: {
													type: 'array',
													items: { type: 'string' },
												},
												restrictedByOrgPolicy: { type: 'boolean' },
												restrictedOrg: { type: 'string' },
												restrictionMessage: { type: 'string' },
												error: { type: 'string' },
											},
											required: ['source', 'configured'],
										},
									},
									methods: {
										type: 'object',
										properties: {
											oauth: { type: 'boolean' },
											token: { type: 'boolean' },
											ghImport: {
												type: 'object',
												properties: {
													available: { type: 'boolean' },
													authenticated: { type: 'boolean' },
													reason: { type: 'string' },
												},
												required: ['available', 'authenticated'],
											},
										},
										required: ['oauth', 'token', 'ghImport'],
									},
								},
								required: ['tokenSources', 'methods'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/auth/onboarding/complete': {
		post: {
			tags: ['auth'],
			operationId: 'completeOnboarding',
			summary: 'Mark onboarding as complete',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { success: { type: 'boolean' } },
								required: ['success'],
							},
						},
					},
				},
			},
		},
	},
} as const;
