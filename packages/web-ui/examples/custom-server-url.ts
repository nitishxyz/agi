#!/usr/bin/env bun
/**
 * Example: Serving web UI with custom server URL
 *
 * This example shows how to serve both the API server and web UI
 * from the same process, with the web UI configured to connect
 * to the current server instead of the default localhost:9100.
 */

import { createApp } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';

const app = createApp();

// Create web UI handler with custom server URL
// Option 1: Explicit server URL
const handleWebUI = serveWebUI({
	prefix: '/ui',
	serverUrl: `http://${host}:${port}`, // Explicitly set server URL
});

// Option 2: Auto-detect from request (recommended for same-server setup)
// const handleWebUI = serveWebUI({
//   prefix: '/ui',
//   // No serverUrl specified - will auto-detect from request
// });

const server = Bun.serve({
	port,
	hostname: host,
	idleTimeout: 240, // 4 minutes - prevents SSE connection timeout
	async fetch(req) {
		const url = new URL(req.url);

		// Serve the bundled web UI first
		const webUIResponse = await handleWebUI(req);
		if (webUIResponse) return webUIResponse;

		// Lightweight health probe
		if (url.pathname === '/api/health') {
			return Response.json({
				status: 'healthy',
				uptime: process.uptime(),
			});
		}

		// Delegate remaining requests to the SDK server
		return app.fetch(req);
	},
});

console.log(`🚀 Server running at: http://${host}:${server.port}`);
console.log(`📱 Web UI available at: http://${host}:${server.port}/ui`);
console.log(`🏥 Health endpoint: http://${host}:${server.port}/api/health`);
console.log(
	`\n✨ Web UI is configured to connect to this server automatically`,
);
