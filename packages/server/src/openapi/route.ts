import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { Handler, Hono } from 'hono';
import type { OperationObject } from 'openapi3-ts/oas30';
import { buildRouteConfig, type HttpMethod } from './register.ts';

type InlineRouteConfig = OperationObject & {
	method: HttpMethod;
	path: string;
};

function registerPlainRoute(
	app: Hono,
	method: HttpMethod,
	path: string,
	handler: Handler,
) {
	const register = app[method as 'get'] as unknown as (
		path: string,
		handler: Handler,
	) => Hono;
	return register.call(app, path, handler);
}

export function openApiRoute(
	app: Hono,
	route: InlineRouteConfig,
	handler: Handler,
): OpenAPIHono;
export function openApiRoute(
	app: Hono,
	method: HttpMethod,
	path: string,
	handler: Handler,
): Hono;
export function openApiRoute(
	app: Hono,
	routeOrMethod: InlineRouteConfig | HttpMethod,
	handlerOrPath: Handler | string,
	maybeHandler?: Handler,
) {
	if (typeof routeOrMethod === 'string') {
		return registerPlainRoute(
			app,
			routeOrMethod,
			handlerOrPath as string,
			maybeHandler as Handler,
		);
	}

	const openApiApp = app as OpenAPIHono;
	const { method, path, ...operation } = routeOrMethod;
	return openApiApp.openapi(
		createRoute(buildRouteConfig(method, path, operation)),
		handlerOrPath as never,
	);
}
