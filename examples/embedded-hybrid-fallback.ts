import { createEmbeddedApp, BUILTIN_AGENTS } from '@agi-cli/server';
import { serveWebUI } from '@agi-cli/web-ui';

/**
 * Hybrid Fallback Architecture
 *
 * Priority Chain:
 * 1. Injected config (highest)
 * 2. Environment variables
 * 3. auth.json/config.json files (fallback)
 */

// Example 1: Empty config - Uses files/env completely
console.log(
	'\n📦 Example 1: No config (falls back to ~/.config/agi/auth.json)',
);
const _app1 = createEmbeddedApp();

// Example 2: Partial override - Model only
console.log('\n📦 Example 2: Override model only (auth from files/env)');
const _app2 = createEmbeddedApp({
	model: 'gpt-4', // Override model, auth/provider from files
});

// Example 3: Provider + Model, auth from env/files
console.log('\n📦 Example 3: Provider + Model (API key from env or auth.json)');
const app3 = createEmbeddedApp({
	provider: 'openai',
	model: 'gpt-4o-mini',
	// No apiKey = falls back to OPENAI_API_KEY env or auth.json
});

// Example 4: Full override
console.log('\n📦 Example 4: Full config (no fallback)');
const _app4 = createEmbeddedApp({
	provider: 'openai',
	model: 'gpt-4',
	apiKey: process.env.OPENAI_API_KEY || '',
	agent: 'general',
	agents: {
		general: { ...BUILTIN_AGENTS.general },
		build: { ...BUILTIN_AGENTS.build },
	},
});

// Example 5: Multi-provider with fallback
console.log(
	'\n📦 Example 5: Multi-provider (some from config, some from files)',
);
const _app5 = createEmbeddedApp({
	provider: 'openai',
	apiKey: process.env.OPENAI_API_KEY, // Can be undefined
	auth: {
		openai: { apiKey: process.env.OPENAI_API_KEY || '' },
		// anthropic not specified -> falls back to auth.json
	},
	defaults: {
		provider: 'openai',
		model: 'gpt-4o-mini',
	},
});

// Use any example
const agiApp = app3; // Try different examples!

// Serve UI
const uiHandler = serveWebUI({ prefix: '/ui' });

Bun.serve({
	port: 3456,
	hostname: '0.0.0.0',
	idleTimeout: 240,
	async fetch(req) {
		const ui = await uiHandler(req);
		if (ui) return ui;
		return agiApp.fetch(req);
	},
});

console.log('\n🚀 Server: http://localhost:3456');
console.log('📱 Web UI: http://localhost:3456/ui');
console.log('\n✨ Fallback chain active:');
console.log('   1. Injected config (code above)');
console.log('   2. Environment variables (e.g., OPENAI_API_KEY)');
console.log('   3. Files (auth.json, config.json)');
