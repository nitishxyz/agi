import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
	OttoTunnel,
	isTunnelBinaryInstalled,
	generateQRCode,
	logger,
} from '@ottocode/sdk';

let activeTunnel: OttoTunnel | null = null;
let tunnelUrl: string | null = null;
let tunnelStatus: 'idle' | 'starting' | 'connected' | 'error' = 'idle';
let tunnelError: string | null = null;
let progressMessage: string | null = null;

export function registerTunnelRoutes(app: Hono) {
	app.get('/v1/tunnel/status', async (c) => {
		const binaryInstalled = await isTunnelBinaryInstalled();

		return c.json({
			status: tunnelStatus,
			url: tunnelUrl,
			error: tunnelError,
			binaryInstalled,
			isRunning: activeTunnel?.isRunning ?? false,
		});
	});

	app.post('/v1/tunnel/start', async (c) => {
		if (activeTunnel?.isRunning) {
			return c.json({
				ok: true,
				url: tunnelUrl,
				message: 'Tunnel already running',
			});
		}

		try {
			const body = await c.req.json().catch(() => ({}));
			const port = body.port || 9100;

			tunnelStatus = 'starting';
			tunnelError = null;
			progressMessage = 'Initializing...';

			activeTunnel = new OttoTunnel();

			const url = await activeTunnel.start(port, (msg) => {
				progressMessage = msg;
				logger.debug('Tunnel progress:', msg);
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
	});

	app.post('/v1/tunnel/register', async (c) => {
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

			logger.debug('External tunnel registered:', url);

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
	});

	app.post('/v1/tunnel/stop', async (c) => {
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
	});

	app.get('/v1/tunnel/qr', async (c) => {
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
	});

	app.get('/v1/tunnel/stream', async (c) => {
		return streamSSE(c, async (stream) => {
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
	});
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
