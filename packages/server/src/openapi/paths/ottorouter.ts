export const ottorouterPaths = {
	'/v1/ottorouter/balance': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getOttoRouterBalance',
			summary: 'Get OttoRouter account balance',
			description:
				'Returns wallet balance, subscription, account info, limits, and usage data',
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
									scope: { type: 'string', enum: ['wallet', 'account'] },
									payg: {
										type: 'object',
										properties: {
											walletBalanceUsd: { type: 'number' },
											accountBalanceUsd: { type: 'number' },
											rawPoolUsd: { type: 'number' },
											effectiveSpendableUsd: { type: 'number' },
										},
									},
									limits: {
										type: 'object',
										nullable: true,
										properties: {
											enabled: { type: 'boolean' },
											dailyLimitUsd: { type: 'number', nullable: true },
											dailySpentUsd: { type: 'number' },
											dailyRemainingUsd: { type: 'number', nullable: true },
											monthlyLimitUsd: { type: 'number', nullable: true },
											monthlySpentUsd: { type: 'number' },
											monthlyRemainingUsd: { type: 'number', nullable: true },
											capRemainingUsd: { type: 'number', nullable: true },
										},
									},
									subscription: {
										type: 'object',
										nullable: true,
										properties: {
											active: { type: 'boolean' },
											tierId: { type: 'string' },
											tierName: { type: 'string' },
											creditsIncluded: { type: 'number' },
											creditsUsed: { type: 'number' },
											creditsRemaining: { type: 'number' },
											periodStart: { type: 'string' },
											periodEnd: { type: 'string' },
										},
									},
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
					description: 'Failed to fetch balance from OttoRouter',
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
	'/v1/ottorouter/wallet': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getOttoRouterWallet',
			summary: 'Get OttoRouter wallet info',
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
	'/v1/ottorouter/usdc-balance': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getOttoRouterUsdcBalance',
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
	'/v1/ottorouter/topup/polar': {
		post: {
			tags: ['ottorouter'],
			operationId: 'createPolarCheckout',
			summary: 'Create a Polar checkout for topping up',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								amount: { type: 'number' },
								successUrl: { type: 'string' },
							},
							required: ['amount', 'successUrl'],
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: { type: 'object' },
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
			},
		},
	},
	'/v1/ottorouter/topup/select': {
		post: {
			tags: ['ottorouter'],
			operationId: 'selectTopupMethod',
			summary: 'Select topup method for pending request',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								sessionId: { type: 'string' },
								method: {
									type: 'string',
									enum: ['crypto', 'fiat'],
								},
							},
							required: ['sessionId', 'method'],
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
									method: { type: 'string' },
								},
								required: ['success', 'method'],
							},
						},
					},
				},
				404: {
					description: 'No pending topup',
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
	'/v1/ottorouter/topup/cancel': {
		post: {
			tags: ['ottorouter'],
			operationId: 'cancelTopup',
			summary: 'Cancel pending topup',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								sessionId: { type: 'string' },
								reason: { type: 'string' },
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
									success: { type: 'boolean' },
								},
								required: ['success'],
							},
						},
					},
				},
				404: {
					description: 'No pending topup',
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
	'/v1/ottorouter/topup/pending': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getPendingTopup',
			summary: 'Get pending topup for a session',
			parameters: [
				{
					in: 'query',
					name: 'sessionId',
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
									hasPending: { type: 'boolean' },
									sessionId: { type: 'string' },
									messageId: { type: 'string' },
									amountUsd: { type: 'number' },
									currentBalance: { type: 'number' },
									createdAt: { type: 'integer' },
								},
								required: ['hasPending'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/ottorouter/topup/polar/estimate': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getPolarTopupEstimate',
			summary: 'Get estimated fees for a Polar topup',
			parameters: [
				{
					in: 'query',
					name: 'amount',
					required: true,
					schema: { type: 'number' },
					description: 'Amount in USD',
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
									creditAmount: { type: 'number' },
									chargeAmount: { type: 'number' },
									feeAmount: { type: 'number' },
									feeBreakdown: {
										type: 'object',
										properties: {
											basePercent: { type: 'number' },
											internationalPercent: { type: 'number' },
											fixedCents: { type: 'number' },
										},
									},
								},
							},
						},
					},
				},
			},
		},
	},
	'/v1/ottorouter/topup/polar/status': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getPolarTopupStatus',
			summary: 'Get status of a Polar checkout',
			parameters: [
				{
					in: 'query',
					name: 'checkoutId',
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
									checkoutId: { type: 'string' },
									confirmed: { type: 'boolean' },
									amountUsd: { type: 'number', nullable: true },
									confirmedAt: { type: 'string', nullable: true },
								},
							},
						},
					},
				},
			},
		},
	},
	'/v1/ottorouter/topup/razorpay/estimate': {
		get: {
			tags: ['ottorouter'],
			operationId: 'getRazorpayTopupEstimate',
			summary: 'Get estimated fees for a Razorpay topup',
			parameters: [
				{
					in: 'query',
					name: 'amount',
					required: true,
					schema: { type: 'number' },
					description: 'Amount in USD',
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
									creditAmountUsd: { type: 'number' },
									chargeAmountInr: { type: 'number' },
									feeAmountInr: { type: 'number' },
									currency: { type: 'string' },
									exchangeRate: { type: 'number' },
								},
							},
						},
					},
				},
			},
		},
	},
	'/v1/ottorouter/topup/razorpay': {
		post: {
			tags: ['ottorouter'],
			operationId: 'createRazorpayOrder',
			summary: 'Create a Razorpay order for topping up',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								amount: { type: 'number' },
							},
							required: ['amount'],
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
									orderId: { type: 'string' },
									amount: { type: 'number' },
									currency: { type: 'string' },
									creditAmountUsd: { type: 'number' },
									keyId: { type: 'string' },
								},
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
			},
		},
	},
	'/v1/ottorouter/topup/razorpay/verify': {
		post: {
			tags: ['ottorouter'],
			operationId: 'verifyRazorpayPayment',
			summary: 'Verify Razorpay payment and credit balance',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								razorpay_order_id: { type: 'string' },
								razorpay_payment_id: { type: 'string' },
								razorpay_signature: { type: 'string' },
							},
							required: [
								'razorpay_order_id',
								'razorpay_payment_id',
								'razorpay_signature',
							],
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
									credited: { type: 'number' },
									newBalance: { type: 'number' },
								},
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
			},
		},
	},
} as const;
