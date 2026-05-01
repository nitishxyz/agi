import type { Hono } from 'hono';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
	OttoTunnel,
	isTunnelBinaryInstalled,
	generateQRCode,
	killStaleTunnels,
	logger,
} from '@ottocode/sdk';
import { getServerPort } from '../state.ts';
import { openApiRoute } from '../openapi/route.ts';

let activeTunnel: OttoTunnel | null = null;
let tunnelUrl: string | null = null;
let tunnelStatus: 'idle' | 'starting' | 'connected' | 'error' = 'idle';
let tunnelError: string | null = null;
let progressMessage: string | null = null;

export function registerTunnelRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/tunnel/status',
			tags: ['tunnel'],
			operationId: 'getTunnelStatus',
			summary: 'Get tunnel status',
			responses: {
				'200': {
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
									url: {
										type: 'string',
										nullable: true,
									},
									error: {
										type: 'string',
										nullable: true,
									},
									binaryInstalled: {
										type: 'boolean',
									},
									isRunning: {
										type: 'boolean',
									},
								},
								required: ['status', 'binaryInstalled', 'isRunning'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const binaryInstalled = await isTunnelBinaryInstalled();

			return c.json({
				status: tunnelStatus,
				url: tunnelUrl,
				error: tunnelError,
				binaryInstalled,
				isRunning: activeTunnel?.isRunning ?? false,
			});
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/tunnel/start',
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
								port: {
									type: 'integer',
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
									url: {
										type: 'string',
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
			},
		},
		async (c) => {
			if (activeTunnel?.isRunning) {
				return c.json({
					ok: true,
					url: tunnelUrl,
					message: 'Tunnel already running',
				});
			}

			try {
				const body = await c.req.json().catch(() => ({}));
				let port = body.port;

				// Use server's known port if not explicitly provided
				if (!port) {
					port = getServerPort() || 9100;
				}

				// Kill any stale tunnel processes first
				await killStaleTunnels();

				tunnelStatus = 'starting';
				tunnelError = null;
				progressMessage = 'Initializing...';

				activeTunnel = new OttoTunnel();

				const url = await activeTunnel.start(port, (msg) => {
					progressMessage = msg;
				});

				tunnelUrl = url;
				tunnelStatus = 'connected';
				progressMessage = null;

				activeTunnel.on('error', (err) => {
					logger.error('Tunnel error:', err);
					tunnelError = err.message;
					tunnelStatus = 'error';
				});

				activeTunnel.on('exit', () => {
					tunnelStatus = 'idle';
					tunnelUrl = null;
					activeTunnel = null;
				});

				return c.json({
					ok: true,
					url: tunnelUrl,
					message: 'Tunnel started',
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				tunnelStatus = 'error';
				tunnelError = message;
				progressMessage = null;

				logger.error('Failed to start tunnel:', error);
				return c.json({ ok: false, error: message }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/tunnel/register',
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
								url: {
									type: 'string',
								},
							},
							required: ['url'],
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
									url: {
										type: 'string',
									},
									message: {
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
			try {
				const body = await c.req.json().catch(() => ({}));
				const { url } = body;

				if (!url) {
					return c.json({ ok: false, error: 'URL is required' }, 400);
				}

				tunnelUrl = url;
				tunnelStatus = 'connected';
				tunnelError = null;
				progressMessage = null;

				return c.json({
					ok: true,
					url: tunnelUrl,
					message: 'External tunnel registered',
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error('Failed to register external tunnel:', error);
				return c.json({ ok: false, error: message }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/tunnel/stop',
			tags: ['tunnel'],
			operationId: 'stopTunnel',
			summary: 'Stop the tunnel',
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
									message: {
										type: 'string',
									},
								},
								required: ['ok'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			if (!activeTunnel) {
				return c.json({ ok: true, message: 'No tunnel running' });
			}

			try {
				activeTunnel.stop();
				activeTunnel = null;
				tunnelUrl = null;
				tunnelStatus = 'idle';
				tunnelError = null;

				return c.json({ ok: true, message: 'Tunnel stopped' });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return c.json({ ok: false, error: message }, 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/tunnel/qr',
			tags: ['tunnel'],
			operationId: 'getTunnelQR',
			summary: 'Get QR code for tunnel URL',
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
									url: {
										type: 'string',
									},
									qrCode: {
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
			if (!tunnelUrl) {
				return c.json({ ok: false, error: 'No tunnel URL available' }, 400);
			}

			try {
				const qrCode = await generateQRCode(tunnelUrl);
				return c.json({
					ok: true,
					url: tunnelUrl,
					qrCode,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return c.json({ ok: false, error: message }, 500);
			}
		},
	);

	const handleTunnelStream = async (c: Context) => {
		return streamSSE(c as Context, async (stream) => {
			const sendEvent = async (data: Record<string, unknown>) => {
				try {
					await stream.write(`data: ${JSON.stringify(data)}\n\n`);
				} catch (error) {
					logger.error('SSE error writing event', error);
				}
			};

			await sendEvent({
				type: 'status',
				status: tunnelStatus,
				url: tunnelUrl,
				error: tunnelError,
				progress: progressMessage,
			});

			const interval = setInterval(async () => {
				await sendEvent({
					type: 'status',
					status: tunnelStatus,
					url: tunnelUrl,
					error: tunnelError,
					progress: progressMessage,
				});
			}, 1000);

			const onAbort = () => {
				clearInterval(interval);
				stream.close();
			};

			c.req.raw.signal.addEventListener('abort', onAbort, { once: true });

			await new Promise<void>((resolve) => {
				c.req.raw.signal.addEventListener('abort', () => resolve(), {
					once: true,
				});
			});

			clearInterval(interval);
		});
	};

	const tunnelStreamRoute = {
		tags: ['tunnel'],
		summary: 'Subscribe to tunnel status stream',
		responses: {
			'200': {
				description: 'SSE stream of tunnel status updates',
				content: {
					'text/event-stream': {
						schema: { type: 'string' },
					},
				},
			},
		},
	} as const;

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/tunnel/stream',
			operationId: 'subscribeTunnelStream',
			...tunnelStreamRoute,
		},
		handleTunnelStream,
	);
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/tunnel/stream',
			operationId: 'subscribeTunnelStreamPost',
			...tunnelStreamRoute,
		},
		handleTunnelStream,
	);
}

export function stopActiveTunnel() {
	if (activeTunnel) {
		activeTunnel.stop();
		activeTunnel = null;
		tunnelUrl = null;
		tunnelStatus = 'idle';
	}
}

export function setExternalTunnel(tunnel: OttoTunnel, url: string) {
	activeTunnel = tunnel;
	tunnelUrl = url;
	tunnelStatus = 'connected';
	tunnelError = null;
	progressMessage = null;

	tunnel.on('error', (err) => {
		tunnelError = err.message;
		tunnelStatus = 'error';
	});

	tunnel.on('exit', () => {
		tunnelStatus = 'idle';
		tunnelUrl = null;
		activeTunnel = null;
	});
}

export function getActiveTunnelUrl(): string | null {
	return tunnelUrl;
}
