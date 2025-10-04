#!/usr/bin/env bun
/**
 * Ultra-simple example: Serve web UI with one line
 */

import { serveWebUI } from '@agi-cli/web-ui';

const port = 3000;
const webUI = serveWebUI({
	prefix: '/ui',
	redirectRoot: true, // Redirect / to /ui
});

Bun.serve({
	port,
	async fetch(req) {
		return (await webUI(req)) || new Response('Not found', { status: 404 });
	},
});

console.log('✅ Web UI server running!');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🌐 Web UI:      http://localhost:${port}/ui`);
console.log(`🔀 Root:        http://localhost:${port}/ (redirects to /ui)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Press Ctrl+C to stop');
