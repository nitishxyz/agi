import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type {
	MediaTypeObject,
	OperationObject,
	ReferenceObject,
	RequestBodyObject,
	ResponseObject,
} from 'openapi3-ts/oas30';
import { schemas } from './schemas';

export type HttpMethod = RouteConfig['method'];

function isReferenceObject(value: unknown): value is ReferenceObject {
	return Boolean(
		value &&
			typeof value === 'object' &&
			'$ref' in value &&
			typeof (value as { $ref?: unknown }).$ref === 'string',
	);
}

function schemaToZod(schema: unknown) {
	if (!schema || isReferenceObject(schema)) {
		return z.any().openapi(schema as Record<string, unknown>);
	}
	return z.any().openapi(schema as Record<string, unknown>);
}

function convertContent(content: ResponseObject['content']) {
	if (!content) return undefined;
	return Object.fromEntries(
		Object.entries(content).map(([contentType, mediaType]) => [
			contentType,
			{
				...(mediaType as MediaTypeObject),
				schema: schemaToZod((mediaType as MediaTypeObject).schema),
			},
		]),
	);
}

function convertRequestBody(
	requestBody: OperationObject['requestBody'],
): RouteConfig['request'] extends { body?: infer Body } ? Body : never {
	if (!requestBody || isReferenceObject(requestBody))
		return requestBody as never;
	const body = requestBody as RequestBodyObject;
	return {
		...body,
		content: convertContent(body.content) ?? {},
	} as never;
}

function convertResponses(
	operation: OperationObject,
): RouteConfig['responses'] {
	return Object.fromEntries(
		Object.entries(operation.responses ?? {}).map(([status, response]) => {
			if (isReferenceObject(response)) return [status, response];
			return [
				status,
				{
					...(response as ResponseObject),
					content: convertContent((response as ResponseObject).content),
				},
			];
		}),
	) as RouteConfig['responses'];
}

export function buildRouteConfig(
	method: HttpMethod,
	path: string,
	operation: OperationObject,
): RouteConfig {
	return {
		...operation,
		method,
		path,
		request: {
			body: convertRequestBody(operation.requestBody),
		},
		responses: convertResponses(operation),
	} as RouteConfig;
}

export function registerOpenApiComponents(app: OpenAPIHono) {
	for (const [name, schema] of Object.entries(schemas)) {
		app.openAPIRegistry.registerComponent('schemas', name, schema as never);
	}
}
