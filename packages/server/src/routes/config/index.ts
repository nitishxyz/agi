import type { Hono } from 'hono';
import { registerCwdRoute } from './cwd.ts';
import { registerMainConfigRoute } from './main.ts';
import { registerAgentsRoute } from './agents.ts';
import { registerProvidersRoute } from './providers.ts';
import { registerModelsRoutes } from './models.ts';

export function registerConfigRoutes(app: Hono) {
	registerCwdRoute(app);
	registerMainConfigRoute(app);
	registerAgentsRoute(app);
	registerProvidersRoute(app);
	registerModelsRoutes(app);
}
