import { Hono } from 'hono';
import { registerRootRoutes } from '@/server/routes/root.ts';
import { registerOpenApiRoute } from '@/server/routes/openapi.ts';
import { registerSessionsRoutes } from '@/server/routes/sessions.ts';
import { registerSessionMessagesRoutes } from '@/server/routes/sessionMessages.ts';
import { registerSessionStreamRoute } from '@/server/routes/sessionStream.ts';

const app = new Hono();

registerRootRoutes(app);
registerOpenApiRoute(app);
registerSessionsRoutes(app);
registerSessionMessagesRoutes(app);
registerSessionStreamRoute(app);

export default {
	port: 0,
	fetch: app.fetch,
};

export function createApp() {
	return app;
}
