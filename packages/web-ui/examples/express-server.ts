#!/usr/bin/env bun
/**
 * Example: Serving the AGI CLI Web UI with Express
 *
 * First install express: bun add express @types/express
 * Run with: bun run examples/express-server.ts
 */

import express from 'express';
import { getWebUIPath, isWebUIAvailable } from '../dist/index.js';

if (!isWebUIAvailable()) {
	console.error('❌ Web UI assets not found. Run "bun run build" first.');
	process.exit(1);
}

const app = express();
const port = 3000;

// Serve the web UI at /ui
app.use('/ui', express.static(getWebUIPath()));

// Root redirect
app.get('/', (_req, res) => {
	res.redirect('/ui');
});

app.listen(port, () => {
	console.log('✅ Server running!');
	console.log(`🌐 Web UI available at: http://localhost:${port}/ui`);
});
