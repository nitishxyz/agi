import { errorResponse } from '../helpers';

export const tunnelPaths = {
	'/v1/tunnel/status': {
		get: {
			tags: ['tunnel'],
			operationId: 'getTunnelStatus',
			summary: 'Get tunnel status',
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
										enum: ['idle', 'starting', 'connected', 'error'],
									},
									url: { type: 'string', nullable: true },
									error: { type: 'string', nullable: true },
									binaryInstalled: { type: 'boolean' },
									isRunning: { type: 'boolean' },
								},
								required: ['status', 'binaryInstalled', 'isRunning'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/tunnel/start': {
		post: {
			tags: ['tunnel'],
			operationId: 'startTunnel',
			summary: 'Start a tunnel',
			requestBody: {
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								port: { type: 'integer' },
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
									url: { type: 'string' },
									message: { type: 'string' },
									error: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/tunnel/register': {
		post: {
			tags: ['tunnel'],
			operationId: 'registerTunnel',
			summary: 'Register an external tunnel URL',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								url: { type: 'string' },
							},
							required: ['url'],
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
									url: { type: 'string' },
									message: { type: 'string' },
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
	'/v1/tunnel/stop': {
		post: {
			tags: ['tunnel'],
			operationId: 'stopTunnel',
			summary: 'Stop the tunnel',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									message: { type: 'string' },
								},
								required: ['ok'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/tunnel/qr': {
		get: {
			tags: ['tunnel'],
			operationId: 'getTunnelQR',
			summary: 'Get QR code for tunnel URL',
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									url: { type: 'string' },
									qrCode: { type: 'string' },
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
} as const;
