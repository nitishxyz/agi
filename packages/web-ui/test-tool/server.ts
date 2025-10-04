#!/usr/bin/env bun
import { serveWebUI } from '@agi-cli/web-ui';

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const _server = Bun.serve({
	port,
	hostname: host,
	async fetch(req) {
		const url = new URL(req.url);

		// Serve web UI
		const webUIResponse = await serveWebUI({ prefix: '/ui' })(req);
		if (webUIResponse) return webUIResponse;

		// Example API
		if (url.pathname === '/api/health') {
			return Response.json({
				status: 'healthy',
				uptime: process.uptime(),
			});
		}

		return new Response('Not Found', { status: 404 });
	},
});

console.log(`Server: http://${host}:${port}/ui`);
