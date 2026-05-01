import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { Handler, Hono } from 'hono';
import type { OperationObject } from 'openapi3-ts/oas30';
import { buildRouteConfig, type HttpMethod } from './register.ts';

type InlineRouteConfig = OperationObject & {
	method: HttpMethod;
	path: string;
};

export function openApiRoute(
	app: Hono,
	route: InlineRouteConfig,
	handler: Handler,
) {
	const openApiApp = app as OpenAPIHono;
	const { method, path, ...operation } = route;
	return openApiApp.openapi(
		createRoute(buildRouteConfig(method, path, operation)),
		handler as never,
	);
}
