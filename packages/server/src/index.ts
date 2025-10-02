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

function initApp() {
	const app = new Hono();

	if (process.env.NODE_ENV === 'development') {
		app.use(
			'*',
			cors({
				origin: ['http://localhost:5173', 'http://localhost:5174'],
				credentials: true,
			}),
		);
	}

	registerRootRoutes(app);
	registerOpenApiRoute(app);
	registerSessionsRoutes(app);
	registerSessionMessagesRoutes(app);
	registerSessionStreamRoute(app);
	registerAskRoutes(app);
	registerConfigRoutes(app);

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

export function createStandaloneApp(config?: StandaloneAppConfig) {
	const honoApp = new Hono();

	if (process.env.NODE_ENV === 'development') {
		honoApp.use(
			'*',
			cors({
				origin: ['http://localhost:5173', 'http://localhost:5174'],
				credentials: true,
			}),
		);
	}

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);
	registerConfigRoutes(honoApp);

	return honoApp;
}

export type EmbeddedAppConfig = {
	provider: ProviderId;
	model: string;
	apiKey: string;
	agent?: string;
};

export function createEmbeddedApp(config: EmbeddedAppConfig) {
	const honoApp = new Hono();

	if (process.env.NODE_ENV === 'development') {
		honoApp.use(
			'*',
			cors({
				origin: ['http://localhost:5173', 'http://localhost:5174'],
				credentials: true,
			}),
		);
	}

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);

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
