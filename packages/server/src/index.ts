import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ProviderId, AuthInfo } from '@agi-cli/sdk';
import { registerRootRoutes } from './routes/root.ts';
import { registerOpenApiRoute } from './routes/openapi.ts';
import { registerSessionsRoutes } from './routes/sessions.ts';
import { registerSessionMessagesRoutes } from './routes/session-messages.ts';
import { registerSessionStreamRoute } from './routes/session-stream.ts';
import { registerAskRoutes } from './routes/ask.ts';
import { registerConfigRoutes } from './routes/config.ts';
import { registerGitRoutes } from './routes/git.ts';
import type { AgentConfigEntry } from './runtime/agent-registry.ts';

function initApp() {
	const app = new Hono();

	// Enable CORS for localhost and local network access
	app.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:') ||
					origin.startsWith('https://localhost:') ||
					origin.startsWith('https://127.0.0.1:')
				) {
					return origin;
				}
				// Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
				const localNetworkPattern =
					/^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;
				if (localNetworkPattern.test(origin)) {
					return origin;
				}
				// Default to allowing the origin (can be restricted in production)
				return origin;
			},
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
			exposeHeaders: ['Content-Length', 'X-Request-Id'],
			credentials: true,
			maxAge: 600,
		}),
	);

	registerRootRoutes(app);
	registerOpenApiRoute(app);
	registerSessionsRoutes(app);
	registerSessionMessagesRoutes(app);
	registerSessionStreamRoute(app);
	registerAskRoutes(app);
	registerConfigRoutes(app);
	registerGitRoutes(app);

	return app;
}

const app = initApp();

export default {
	port: 0,
	fetch: app.fetch,
};

export function createApp() {
	return app;
}

export type StandaloneAppConfig = {
	provider?: ProviderId;
	model?: string;
	defaultAgent?: string;
};

export function createStandaloneApp(_config?: StandaloneAppConfig) {
	const honoApp = new Hono();

	// Enable CORS for localhost and local network access
	honoApp.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:') ||
					origin.startsWith('https://localhost:') ||
					origin.startsWith('https://127.0.0.1:')
				) {
					return origin;
				}
				// Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
				const localNetworkPattern =
					/^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;
				if (localNetworkPattern.test(origin)) {
					return origin;
				}
				// Default to allowing the origin
				return origin;
			},
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
			exposeHeaders: ['Content-Length', 'X-Request-Id'],
			credentials: true,
			maxAge: 600,
		}),
	);

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);
	registerConfigRoutes(honoApp);
	registerGitRoutes(honoApp);

	return honoApp;
}

/**
 * Embedded app configuration with hybrid fallback:
 * 1. Injected config (highest priority)
 * 2. Environment variables
 * 3. auth.json/config.json files (fallback)
 *
 * All fields are optional - if not provided, falls back to files/env
 */
export type EmbeddedAppConfig = {
	/** Primary provider (optional - falls back to config.json or env) */
	provider?: ProviderId;
	/** Primary model (optional - falls back to config.json) */
	model?: string;
	/** Primary API key (optional - falls back to env vars or auth.json) */
	apiKey?: string;
	/** Default agent (optional - falls back to config.json) */
	agent?: string;
	/** Multi-provider auth (optional - falls back to auth.json) */
	auth?: Record<string, { apiKey: string } | AuthInfo>;
	/** Custom agents (optional - falls back to .agi/agents/) */
	agents?: Record<
		string,
		Omit<AgentConfigEntry, 'tools'> & { tools?: readonly string[] | string[] }
	>;
	/** Default settings (optional - falls back to config.json) */
	defaults?: {
		provider?: ProviderId;
		model?: string;
		agent?: string;
	};
	/** Additional CORS origins for proxies/Tailscale (e.g., ['https://myapp.ts.net', 'https://example.com']) */
	corsOrigins?: string[];
};

export function createEmbeddedApp(config: EmbeddedAppConfig = {}) {
	const honoApp = new Hono();

	// Store injected config in Hono context for routes to access
	// Config can be empty - routes will fall back to files/env
	honoApp.use('*', async (c, next) => {
		c.set('embeddedConfig', config);
		await next();
	});

	// Enable CORS for localhost and local network access
	honoApp.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:') ||
					origin.startsWith('https://localhost:') ||
					origin.startsWith('https://127.0.0.1:')
				) {
					return origin;
				}
				// Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
				const localNetworkPattern =
					/^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;
				if (localNetworkPattern.test(origin)) {
					return origin;
				}
				// Allow custom CORS origins (for Tailscale, proxies, etc.)
				if (config.corsOrigins?.includes(origin)) {
					return origin;
				}
				// Default to allowing the origin
				return origin;
			},
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
			exposeHeaders: ['Content-Length', 'X-Request-Id'],
			credentials: true,
			maxAge: 600,
		}),
	);

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);
	registerConfigRoutes(honoApp);
	registerGitRoutes(honoApp);

	return honoApp;
}

export {
	resolveAgentConfig,
	defaultToolsForAgent,
} from './runtime/agent-registry.ts';
export { composeSystemPrompt } from './runtime/prompt.ts';
export {
	AskServiceError,
	handleAskRequest,
	deriveStatusFromMessage,
	inferStatus,
} from './runtime/ask-service.ts';
export { registerSessionsRoutes } from './routes/sessions.ts';
export { registerAskRoutes } from './routes/ask.ts';
export {
	BUILTIN_AGENTS,
	BUILTIN_TOOLS,
	type BuiltinAgent,
	type BuiltinTool,
} from './presets.ts';

// Export debug state management
export { setDebugEnabled, isDebugEnabled, setTraceEnabled, isTraceEnabled } from './runtime/debug-state.ts';
export { logger } from './runtime/logger.ts';
