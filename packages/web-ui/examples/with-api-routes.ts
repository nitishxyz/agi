#!/usr/bin/env bun
/**
 * Example: Combine web UI with custom API routes
 */

import { serveWebUI } from '@ottocode/web-ui';

const port = 3000;
const webUI = serveWebUI({ prefix: '/ui' });

Bun.serve({
	port,
	idleTimeout: 240, // 4 minutes - prevents SSE connection timeout
	async fetch(req) {
		const url = new URL(req.url);

		// Custom API routes
		if (url.pathname === '/api/hello') {
			return new Response(
				JSON.stringify({
					message: 'Hello from your API!',
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		if (url.pathname === '/api/time') {
			return new Response(
				JSON.stringify({
					timestamp: new Date().toISOString(),
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		// Try web UI handler
		const webUIResponse = await webUI(req);
		if (webUIResponse) return webUIResponse;

		// Final fallback
		return new Response('Not found', { status: 404 });
	},
});

console.log('✅ Server running with Web UI + API routes!');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🌐 Web UI:      http://localhost:${port}/ui`);
console.log(`🔌 API Hello:   http://localhost:${port}/api/hello`);
console.log(`⏰ API Time:    http://localhost:${port}/api/time`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Press Ctrl+C to stop');
