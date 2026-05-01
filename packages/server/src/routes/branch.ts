import type { Hono } from 'hono';
import { loadConfig } from '@ottocode/sdk';
import { getDb } from '@ottocode/database';
import { hasConfiguredProvider, logger } from '@ottocode/sdk';
import {
	createBranch,
	listBranches,
	getParentSession,
} from '../runtime/session/branch.ts';
import { serializeError } from '../runtime/errors/api-error.ts';
import { openApiRoute } from '../openapi/route.ts';

export function registerBranchRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions/{sessionId}/branch',
			tags: ['sessions'],
			operationId: 'createBranch',
			summary: 'Create a branch from a session message',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								fromMessageId: {
									type: 'string',
								},
								provider: {
									type: 'string',
								},
								model: {
									type: 'string',
								},
								agent: {
									type: 'string',
								},
								title: {
									type: 'string',
								},
							},
							required: ['fromMessageId'],
						},
					},
				},
			},
			responses: {
				'201': {
					description: 'Created',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Session',
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const sessionId = c.req.param('sessionId');
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const db = await getDb(cfg.projectRoot);

				const body = (await c.req.json().catch(() => ({}))) as Record<
					string,
					unknown
				>;

				const fromMessageId = body.fromMessageId;
				if (typeof fromMessageId !== 'string' || !fromMessageId.trim()) {
					return c.json({ error: 'fromMessageId is required' }, 400);
				}

				const provider =
					typeof body.provider === 'string' &&
					hasConfiguredProvider(cfg, body.provider)
						? body.provider
						: undefined;

				const model =
					typeof body.model === 'string' && body.model.trim()
						? body.model.trim()
						: undefined;

				const agent =
					typeof body.agent === 'string' && body.agent.trim()
						? body.agent.trim()
						: undefined;

				const title =
					typeof body.title === 'string' && body.title.trim()
						? body.title.trim()
						: undefined;

				const result = await createBranch({
					db,
					parentSessionId: sessionId,
					fromMessageId: fromMessageId.trim(),
					provider,
					model,
					agent,
					title,
					projectPath: cfg.projectRoot,
				});

				return c.json(result, 201);
			} catch (err) {
				logger.error('Failed to create branch', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 400);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{sessionId}/branches',
			tags: ['sessions'],
			operationId: 'listBranches',
			summary: 'List branches of a session',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									branches: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/Session',
										},
									},
								},
								required: ['branches'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const sessionId = c.req.param('sessionId');
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const db = await getDb(cfg.projectRoot);

				const branches = await listBranches(db, sessionId, cfg.projectRoot);

				return c.json({ branches });
			} catch (err) {
				logger.error('Failed to list branches', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{sessionId}/parent',
			tags: ['sessions'],
			operationId: 'getParentSession',
			summary: 'Get parent session of a branch',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									parent: {
										nullable: true,
										allOf: [
											{
												$ref: '#/components/schemas/Session',
											},
										],
									},
								},
								required: ['parent'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const sessionId = c.req.param('sessionId');
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const db = await getDb(cfg.projectRoot);

				const parent = await getParentSession(db, sessionId, cfg.projectRoot);

				if (!parent) {
					return c.json({ parent: null });
				}

				return c.json({ parent });
			} catch (err) {
				logger.error('Failed to get parent session', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);
}
