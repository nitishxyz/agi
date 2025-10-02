import { Hono } from 'hono';
import type { ProviderId } from '@agi-cli/providers';
import { registerRootRoutes } from './routes/root.ts';
import { registerOpenApiRoute } from './routes/openapi.ts';
import { registerSessionsRoutes } from './routes/sessions.ts';
import { registerSessionMessagesRoutes } from './routes/sessionMessages.ts';
import { registerSessionStreamRoute } from './routes/sessionStream.ts';
import { registerAskRoutes } from './routes/ask.ts';

const app = new Hono();

registerRootRoutes(app);
registerOpenApiRoute(app);
registerSessionsRoutes(app);
registerSessionMessagesRoutes(app);
registerSessionStreamRoute(app);
registerAskRoutes(app);

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

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);

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

	registerRootRoutes(honoApp);
	registerOpenApiRoute(honoApp);
	registerSessionsRoutes(honoApp);
	registerSessionMessagesRoutes(honoApp);
	registerSessionStreamRoute(honoApp);
	registerAskRoutes(honoApp);

	return honoApp;
}

// Re-export commonly used runtime modules for testing
export {
	resolveAgentConfig,
	defaultToolsForAgent,
} from './runtime/agentRegistry.ts';
export { composeSystemPrompt } from './runtime/prompt.ts';
export {
	AskServiceError,
	handleAskRequest,
	deriveStatusFromMessage,
	inferStatus,
} from './runtime/askService.ts';
export { registerSessionsRoutes } from './routes/sessions.ts';
export { registerAskRoutes } from './routes/ask.ts';
