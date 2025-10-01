import { Hono } from 'hono';
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
