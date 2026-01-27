export const setuPaths = {
	'/v1/setu/balance': {
		get: {
			tags: ['setu'],
			operationId: 'getSetuBalance',
			summary: 'Get Setu account balance',
			description:
				'Returns wallet balance, total spent, total topups, and request count',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									walletAddress: { type: 'string' },
									balance: { type: 'number' },
									totalSpent: { type: 'number' },
									totalTopups: { type: 'number' },
									requestCount: { type: 'number' },
								},
								required: [
									'walletAddress',
									'balance',
									'totalSpent',
									'totalTopups',
									'requestCount',
								],
							},
						},
					},
				},
				401: {
					description: 'Wallet not configured',
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
				502: {
					description: 'Failed to fetch balance from Setu',
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
	'/v1/setu/wallet': {
		get: {
			tags: ['setu'],
			operationId: 'getSetuWallet',
			summary: 'Get Setu wallet info',
			description:
				'Returns whether the wallet is configured and its public key',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									configured: { type: 'boolean' },
									publicKey: { type: 'string' },
									error: { type: 'string' },
								},
								required: ['configured'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/setu/usdc-balance': {
		get: {
			tags: ['setu'],
			operationId: 'getSetuUsdcBalance',
			summary: 'Get USDC token balance',
			description:
				'Fetches USDC balance from Solana blockchain for the configured wallet',
			parameters: [
				{
					in: 'query',
					name: 'network',
					schema: {
						type: 'string',
						enum: ['mainnet', 'devnet'],
						default: 'mainnet',
					},
					description: 'Solana network to query',
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
									walletAddress: { type: 'string' },
									usdcBalance: { type: 'number' },
									network: {
										type: 'string',
										enum: ['mainnet', 'devnet'],
									},
								},
								required: ['walletAddress', 'usdcBalance', 'network'],
							},
						},
					},
				},
				401: {
					description: 'Wallet not configured',
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
				502: {
					description: 'Failed to fetch USDC balance from Solana',
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
} as const;
