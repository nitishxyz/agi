import { createEmbeddedApp, BUILTIN_AGENTS } from '@ottocode/server';
import { serveWebUI } from '@ottocode/web-ui';

// Create embedded otto app
const ottoApp = createEmbeddedApp({
	provider: 'openrouter',
	model: 'z-ai/glm-4.6',
	apiKey: process.env.OPENROUTER_API_KEY || '',
	agent: 'general',
	agents: {
		// Use built-in agents with autocomplete
		general: { ...BUILTIN_AGENTS.general },
		build: { ...BUILTIN_AGENTS.build },
		plan: { ...BUILTIN_AGENTS.plan },
	},
});

// Create UI handler
const uiHandler = serveWebUI({
	prefix: '/ui',
});

// Combined server
Bun.serve({
	port: 3456,
	hostname: '0.0.0.0',
	idleTimeout: 240,
	async fetch(req) {
		// Serve Web UI first
		const webUIResponse = await uiHandler(req);
		if (webUIResponse) return webUIResponse;

		// Delegate to API server
		return ottoApp.fetch(req);
	},
});

console.log('🚀 otto server running at http://localhost:3456');
console.log('📱 Web UI available at http://localhost:3456/ui');
