import { errorResponse } from '../helpers';

export const providerUsagePaths = {
	'/v1/provider-usage/{provider}': {
		get: {
			tags: ['config'],
			operationId: 'getProviderUsage',
			summary: 'Get usage information for an OAuth provider',
			parameters: [
				{
					in: 'path',
					name: 'provider',
					required: true,
					schema: { type: 'string', enum: ['anthropic', 'openai'] },
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
									provider: { type: 'string' },
									primaryWindow: {
										type: 'object',
										nullable: true,
										properties: {
											usedPercent: { type: 'number' },
											windowSeconds: { type: 'integer' },
											resetsAt: { type: 'string', nullable: true },
											resetAfterSeconds: { type: 'integer' },
										},
									},
									secondaryWindow: {
										type: 'object',
										nullable: true,
										properties: {
											usedPercent: { type: 'number' },
											windowSeconds: { type: 'integer' },
											resetsAt: { type: 'string', nullable: true },
											resetAfterSeconds: { type: 'integer' },
										},
									},
									limitReached: { type: 'boolean' },
									planType: { type: 'string', nullable: true },
								},
								required: ['provider', 'limitReached'],
							},
						},
					},
				},
				400: errorResponse(),
				404: errorResponse(),
			},
		},
	},
} as const;
