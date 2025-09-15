import type { Hono } from 'hono';
import { getOpenAPISpec } from '../../openapi/spec.ts';

export function registerOpenApiRoute(app: Hono) {
	app.get('/openapi.json', (c) => c.json(getOpenAPISpec()));
}
