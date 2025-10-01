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
