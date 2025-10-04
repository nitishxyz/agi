import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ProviderId } from '@agi-cli/providers';
import { registerRootRoutes } from './routes/root.ts';
import { registerOpenApiRoute } from './routes/openapi.ts';
import { registerSessionsRoutes } from './routes/sessions.ts';
import { registerSessionMessagesRoutes } from './routes/session-messages.ts';
import { registerSessionStreamRoute } from './routes/session-stream.ts';
import { registerAskRoutes } from './routes/ask.ts';
import { registerConfigRoutes } from './routes/config.ts';
import { registerGitRoutes } from './routes/git.ts';

function initApp() {
	const app = new Hono();

	// Enable CORS for all localhost ports (for web UI on random ports)
	app.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:')
				) {
					return origin;
				}
				// Allow common dev ports
				if (
					origin === 'http://localhost:5173' ||
					origin === 'http://localhost:5174'
				) {
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

	// Enable CORS for all localhost ports (for web UI on random ports)
	honoApp.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:')
				) {
					return origin;
				}
				// Allow common dev ports
				if (
					origin === 'http://localhost:5173' ||
					origin === 'http://localhost:5174'
				) {
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

export type EmbeddedAppConfig = {
	provider: ProviderId;
	model: string;
	apiKey: string;
	agent?: string;
};

export function createEmbeddedApp(_config: EmbeddedAppConfig) {
	const honoApp = new Hono();

	// Enable CORS for all localhost ports (for web UI on random ports)
	honoApp.use(
		'*',
		cors({
			origin: (origin) => {
				// Allow all localhost and 127.0.0.1 on any port
				if (
					origin.startsWith('http://localhost:') ||
					origin.startsWith('http://127.0.0.1:')
				) {
					return origin;
				}
				// Allow common dev ports
				if (
					origin === 'http://localhost:5173' ||
					origin === 'http://localhost:5174'
				) {
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
