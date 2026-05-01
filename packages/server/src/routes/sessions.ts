import type { Hono } from 'hono';
import { loadConfig } from '@ottocode/sdk';
import { userInfo } from 'node:os';
import { getDb } from '@ottocode/database';
import {
	sessions,
	messages,
	messageParts,
	shares,
} from '@ottocode/database/schema';
import { desc, eq, and, ne, inArray, or } from 'drizzle-orm';
import type { ProviderId } from '@ottocode/sdk';
import { hasConfiguredProvider, validateProviderModel } from '@ottocode/sdk';
import { resolveAgentConfig } from '../runtime/agent/registry.ts';
import { createSession as createSessionRow } from '../runtime/session/manager.ts';
import { serializeError } from '../runtime/errors/api-error.ts';
import { logger } from '@ottocode/sdk';
import { getRunnerState } from '../runtime/session/queue.ts';
import { openApiRoute } from '../openapi/route.ts';

export function registerSessionsRoutes(app: Hono) {
	// List sessions
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions',
			tags: ['sessions'],
			operationId: 'listSessions',
			summary: 'List sessions',
			parameters: [
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
				{
					in: 'query',
					name: 'limit',
					schema: {
						type: 'integer',
						default: 50,
						minimum: 1,
						maximum: 200,
					},
					description: 'Maximum number of sessions to return',
				},
				{
					in: 'query',
					name: 'offset',
					schema: {
						type: 'integer',
						default: 0,
						minimum: 0,
					},
					description: 'Offset for pagination',
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
									items: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/Session',
										},
									},
									hasMore: {
										type: 'boolean',
									},
									nextOffset: {
										type: 'integer',
										nullable: true,
									},
								},
								required: ['items', 'hasMore', 'nextOffset'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const projectRoot = c.req.query('project') || process.cwd();
			const limit = Math.min(
				Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1),
				200,
			);
			const offset = Math.max(
				parseInt(c.req.query('offset') || '0', 10) || 0,
				0,
			);
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);
			// Only return sessions for this project, excluding research sessions
			const rows = await db
				.select()
				.from(sessions)
				.where(
					and(
						eq(sessions.projectPath, cfg.projectRoot),
						ne(sessions.sessionType, 'research'),
					),
				)
				.orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt))
				.limit(limit + 1)
				.offset(offset);
			const hasMore = rows.length > limit;
			const page = hasMore ? rows.slice(0, limit) : rows;
			const normalized = page.map((r) => {
				let counts: Record<string, unknown> | undefined;
				if (r.toolCountsJson) {
					try {
						const parsed = JSON.parse(r.toolCountsJson);
						if (
							parsed &&
							typeof parsed === 'object' &&
							!Array.isArray(parsed)
						) {
							counts = parsed as Record<string, unknown>;
						}
					} catch {}
				}
				const { toolCountsJson: _toolCountsJson, ...rest } = r;
				const isRunning = getRunnerState(r.id)?.running ?? false;
				const base = counts ? { ...rest, toolCounts: counts } : rest;
				return { ...base, isRunning };
			});
			return c.json({
				items: normalized,
				hasMore,
				nextOffset: hasMore ? offset + limit : null,
			});
		},
	);

	// Create session
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions',
			tags: ['sessions'],
			operationId: 'createSession',
			summary: 'Create a new session',
			parameters: [
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
				required: false,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								title: {
									type: 'string',
									nullable: true,
								},
								agent: {
									type: 'string',
								},
								provider: {
									$ref: '#/components/schemas/Provider',
								},
								model: {
									type: 'string',
								},
							},
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
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);
			const body = (await c.req.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			const agent = (body.agent as string | undefined) ?? cfg.defaults.agent;
			const agentCfg = await resolveAgentConfig(cfg.projectRoot, agent);
			const providerCandidate =
				typeof body.provider === 'string' ? body.provider : undefined;
			const provider: ProviderId = (() => {
				if (providerCandidate && hasConfiguredProvider(cfg, providerCandidate))
					return providerCandidate;
				if (hasConfiguredProvider(cfg, agentCfg.provider))
					return agentCfg.provider;
				return cfg.defaults.provider;
			})();
			const modelCandidate =
				typeof body.model === 'string' ? body.model.trim() : undefined;
			const model = modelCandidate?.length
				? modelCandidate
				: (agentCfg.model ?? cfg.defaults.model);
			try {
				const row = await createSessionRow({
					db,
					cfg,
					agent,
					provider,
					model,
					title: (body.title as string | null | undefined) ?? null,
				});
				return c.json(row, 201);
			} catch (err) {
				logger.error('Failed to create session', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 400);
			}
		},
	);

	// Get single session
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{sessionId}',
			tags: ['sessions'],
			operationId: 'getSession',
			summary: 'Get a single session by ID',
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
								$ref: '#/components/schemas/Session',
							},
						},
					},
				},
				'404': {
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
				const rows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId))
					.limit(1);
				if (!rows.length) {
					return c.json(
						{ error: { message: 'Session not found', status: 404 } },
						404,
					);
				}
				const r = rows[0];
				let counts: Record<string, unknown> | undefined;
				if (r.toolCountsJson) {
					try {
						const parsed = JSON.parse(r.toolCountsJson);
						if (
							parsed &&
							typeof parsed === 'object' &&
							!Array.isArray(parsed)
						) {
							counts = parsed as Record<string, unknown>;
						}
					} catch {}
				}
				const { toolCountsJson: _toolCountsJson, ...rest } = r;
				return c.json(counts ? { ...rest, toolCounts: counts } : rest);
			} catch (err) {
				logger.error('Failed to get session', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	// Update session preferences
	openApiRoute(
		app,
		{
			method: 'patch',
			path: '/v1/sessions/{sessionId}',
			tags: ['sessions'],
			operationId: 'updateSession',
			summary: 'Update session preferences',
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
								title: {
									type: 'string',
								},
								agent: {
									type: 'string',
								},
								provider: {
									$ref: '#/components/schemas/Provider',
								},
								model: {
									type: 'string',
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
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
				'404': {
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

				// Fetch existing session
				const existingRows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId))
					.limit(1);

				if (!existingRows.length) {
					return c.json({ error: 'Session not found' }, 404);
				}

				const existingSession = existingRows[0];

				// Verify session belongs to current project
				if (existingSession.projectPath !== cfg.projectRoot) {
					return c.json({ error: 'Session not found in this project' }, 404);
				}

				// Prepare update data
				const updates: {
					agent?: string;
					provider?: string;
					model?: string;
					title?: string | null;
					lastActiveAt?: number;
				} = {
					lastActiveAt: Date.now(),
				};

				if (typeof body.title === 'string') {
					updates.title = body.title.trim() || null;
				}

				// Validate agent if provided
				if (typeof body.agent === 'string') {
					const agentName = body.agent.trim();
					if (agentName) {
						// Agent validation: check if it exists via resolveAgentConfig
						try {
							await resolveAgentConfig(cfg.projectRoot, agentName);
							updates.agent = agentName;
						} catch (err) {
							logger.warn('Invalid agent provided', { agent: agentName, err });
							return c.json({ error: `Invalid agent: ${agentName}` }, 400);
						}
					}
				}

				// Validate provider if provided
				if (typeof body.provider === 'string') {
					const providerName = body.provider.trim();
					if (providerName && hasConfiguredProvider(cfg, providerName)) {
						updates.provider = providerName;
					} else if (providerName) {
						return c.json({ error: `Invalid provider: ${providerName}` }, 400);
					}
				}

				// Validate model if provided (and optionally verify it belongs to provider)
				if (typeof body.model === 'string') {
					const modelName = body.model.trim();
					if (modelName) {
						const targetProvider = (updates.provider ||
							existingSession.provider) as ProviderId;
						try {
							validateProviderModel(targetProvider, modelName, cfg);
						} catch {
							return c.json(
								{
									error: `Model "${modelName}" not found for provider "${targetProvider}"`,
								},
								400,
							);
						}

						updates.model = modelName;
					}
				}

				// Perform update
				await db
					.update(sessions)
					.set(updates)
					.where(eq(sessions.id, sessionId));

				// Return updated session
				const updatedRows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId))
					.limit(1);

				return c.json(updatedRows[0]);
			} catch (err) {
				logger.error('Failed to update session', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	// Delete session
	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/sessions/{sessionId}',
			tags: ['sessions'],
			operationId: 'deleteSession',
			summary: 'Delete a session',
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
									success: {
										type: 'boolean',
									},
								},
								required: ['success'],
							},
						},
					},
				},
				'404': {
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

				const existingRows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId))
					.limit(1);

				if (!existingRows.length) {
					return c.json({ error: 'Session not found' }, 404);
				}

				const existingSession = existingRows[0];

				if (existingSession.projectPath !== cfg.projectRoot) {
					return c.json({ error: 'Session not found in this project' }, 404);
				}

				await db
					.delete(messageParts)
					.where(
						inArray(
							messageParts.messageId,
							db
								.select({ id: messages.id })
								.from(messages)
								.where(eq(messages.sessionId, sessionId)),
						),
					);
				await db.delete(messages).where(eq(messages.sessionId, sessionId));
				await db.delete(sessions).where(eq(sessions.id, sessionId));

				return c.json({ success: true });
			} catch (err) {
				logger.error('Failed to delete session', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);

	// Abort session stream
	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/sessions/{sessionId}/abort',
			tags: ['sessions'],
			operationId: 'abortSession',
			summary: 'Abort a running session',
			description:
				'Aborts any currently running assistant generation for the session',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: {
						type: 'string',
					},
					description: 'Session ID to abort',
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
									success: {
										type: 'boolean',
									},
								},
								required: ['success'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const sessionId = c.req.param('sessionId');
			const body = (await c.req.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			const messageId =
				typeof body.messageId === 'string' ? body.messageId : undefined;
			const clearQueue = body.clearQueue === true;

			const { abortSession, abortMessage } = await import(
				'../runtime/agent/runner.ts'
			);

			if (messageId) {
				const result = abortMessage(sessionId, messageId);
				return c.json({
					success: result.removed,
					wasRunning: result.wasRunning,
					messageId,
				});
			}

			abortSession(sessionId, clearQueue);
			return c.json({ success: true });
		},
	);

	// Get queue state for a session
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{sessionId}/queue',
			tags: ['sessions'],
			operationId: 'getSessionQueue',
			summary: 'Get queue state for a session',
			parameters: [
				{
					in: 'path',
					name: 'sessionId',
					required: true,
					schema: {
						type: 'string',
					},
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
									currentMessageId: {
										type: 'string',
										nullable: true,
									},
									queuedMessages: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												assistantMessageId: {
													type: 'string',
												},
												agent: {
													type: 'string',
												},
												provider: {
													type: 'string',
												},
												model: {
													type: 'string',
												},
											},
										},
									},
									isRunning: {
										type: 'boolean',
									},
								},
								required: ['currentMessageId', 'queuedMessages', 'isRunning'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const sessionId = c.req.param('sessionId');
			const { getQueueState } = await import('../runtime/session/queue.ts');
			const state = getQueueState(sessionId);
			return c.json(
				state ?? {
					currentMessageId: null,
					queuedMessages: [],
					isRunning: false,
				},
			);
		},
	);

	// Remove a message from the queue
	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/sessions/{sessionId}/queue/{messageId}',
			tags: ['sessions'],
			operationId: 'removeFromQueue',
			summary: 'Remove a message from session queue',
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
					in: 'path',
					name: 'messageId',
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
									success: {
										type: 'boolean',
									},
									removed: {
										type: 'boolean',
									},
									wasQueued: {
										type: 'boolean',
									},
									wasRunning: {
										type: 'boolean',
									},
									wasStored: {
										type: 'boolean',
									},
								},
								required: ['success'],
							},
						},
					},
				},
				'404': {
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
			const sessionId = c.req.param('sessionId');
			const messageId = c.req.param('messageId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);
			const { removeFromQueue, abortMessage } = await import(
				'../runtime/session/queue.ts'
			);

			// First try to remove from queue (queued messages)
			const removed = removeFromQueue(sessionId, messageId);
			if (removed) {
				// Delete messages from database
				try {
					// Find the assistant message to get its creation time
					const assistantMsg = await db
						.select()
						.from(messages)
						.where(eq(messages.id, messageId))
						.limit(1);

					if (assistantMsg.length > 0) {
						// Find the user message that came right before (same session, created just before)
						const userMsg = await db
							.select()
							.from(messages)
							.where(
								and(
									eq(messages.sessionId, sessionId),
									eq(messages.role, 'user'),
								),
							)
							.orderBy(desc(messages.createdAt))
							.limit(1);

						const messageIdsToDelete = [messageId];
						if (userMsg.length > 0) {
							messageIdsToDelete.push(userMsg[0].id);
						}

						// Delete message parts first (foreign key constraint)
						await db
							.delete(messageParts)
							.where(inArray(messageParts.messageId, messageIdsToDelete));
						// Delete messages
						await db
							.delete(messages)
							.where(inArray(messages.id, messageIdsToDelete));
					}
				} catch (err) {
					logger.error('Failed to delete queued messages from DB', err);
				}
				return c.json({ success: true, removed: true, wasQueued: true });
			}

			// If not in queue, try to abort (might be running)
			const result = abortMessage(sessionId, messageId);
			if (result.removed) {
				return c.json({
					success: true,
					removed: true,
					wasQueued: false,
					wasRunning: result.wasRunning,
				});
			}

			// If not queued or running, try to delete directly from database
			// This handles system messages (like injected research context)
			try {
				const existingMsg = await db
					.select()
					.from(messages)
					.where(
						and(eq(messages.id, messageId), eq(messages.sessionId, sessionId)),
					)
					.limit(1);

				if (existingMsg.length > 0) {
					// Delete message parts first (foreign key constraint)
					await db
						.delete(messageParts)
						.where(
							and(
								eq(messageParts.messageId, messageId),
								or(
									eq(messageParts.type, 'error'),
									and(
										eq(messageParts.type, 'tool_call'),
										eq(messageParts.toolName, 'finish'),
									),
								),
							),
						);
					// Delete message
					await db.delete(messages).where(eq(messages.id, messageId));

					return c.json({ success: true, removed: true, wasStored: true });
				}
			} catch (err) {
				logger.error('Failed to delete message from DB', err);
				return c.json(
					{ success: false, error: 'Failed to delete message' },
					500,
				);
			}

			return c.json({ success: false, removed: false }, 404);
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{sessionId}/share',
			tags: ['sessions'],
			operationId: 'getShareStatus',
			summary: 'Get share status for a session',
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
									shared: {
										type: 'boolean',
									},
									shareId: {
										type: 'string',
									},
									url: {
										type: 'string',
									},
									title: {
										type: 'string',
										nullable: true,
									},
									createdAt: {
										type: 'integer',
									},
									lastSyncedAt: {
										type: 'integer',
									},
									lastSyncedMessageId: {
										type: 'string',
									},
									syncedMessages: {
										type: 'integer',
									},
									totalMessages: {
										type: 'integer',
									},
									pendingMessages: {
										type: 'integer',
									},
									isSynced: {
										type: 'boolean',
									},
								},
								required: ['shared'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const share = await db
				.select()
				.from(shares)
				.where(eq(shares.sessionId, sessionId))
				.limit(1);

			if (!share.length) {
				return c.json({ shared: false });
			}

			const allMessages = await db
				.select({ id: messages.id })
				.from(messages)
				.where(eq(messages.sessionId, sessionId))
				.orderBy(messages.createdAt);

			const totalMessages = allMessages.length;
			const syncedIdx = allMessages.findIndex(
				(m) => m.id === share[0].lastSyncedMessageId,
			);
			const syncedMessages = syncedIdx === -1 ? 0 : syncedIdx + 1;
			const pendingMessages = totalMessages - syncedMessages;

			return c.json({
				shared: true,
				shareId: share[0].shareId,
				url: share[0].url,
				title: share[0].title,
				createdAt: share[0].createdAt,
				lastSyncedAt: share[0].lastSyncedAt,
				lastSyncedMessageId: share[0].lastSyncedMessageId,
				syncedMessages,
				totalMessages,
				pendingMessages,
				isSynced: pendingMessages === 0,
			});
		},
	);

	const SHARE_API_URL =
		process.env.OTTO_SHARE_API_URL || 'https://api.share.ottocode.io';

	function getUsername(): string {
		try {
			return userInfo().username;
		} catch {
			return 'anonymous';
		}
	}

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions/{sessionId}/share',
			tags: ['sessions'],
			operationId: 'shareSession',
			summary: 'Share a session',
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
									shared: {
										type: 'boolean',
									},
									shareId: {
										type: 'string',
									},
									url: {
										type: 'string',
									},
									message: {
										type: 'string',
									},
								},
								required: ['shared'],
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
				'404': {
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
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const session = await db
				.select()
				.from(sessions)
				.where(eq(sessions.id, sessionId))
				.limit(1);
			if (!session.length) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const existingShare = await db
				.select()
				.from(shares)
				.where(eq(shares.sessionId, sessionId))
				.limit(1);
			if (existingShare.length) {
				return c.json({
					shared: true,
					shareId: existingShare[0].shareId,
					url: existingShare[0].url,
					message: 'Already shared',
				});
			}

			const allMessages = await db
				.select()
				.from(messages)
				.where(eq(messages.sessionId, sessionId))
				.orderBy(messages.createdAt);

			if (!allMessages.length) {
				return c.json({ error: 'Session has no messages' }, 400);
			}

			const msgParts = await db
				.select()
				.from(messageParts)
				.where(
					inArray(
						messageParts.messageId,
						allMessages.map((m) => m.id),
					),
				)
				.orderBy(messageParts.index);

			const partsByMessage = new Map<string, typeof msgParts>();
			for (const part of msgParts) {
				const list = partsByMessage.get(part.messageId) || [];
				list.push(part);
				partsByMessage.set(part.messageId, list);
			}

			const lastMessageId = allMessages[allMessages.length - 1].id;
			const sess = session[0];

			const sessionData = {
				title: sess.title,
				username: getUsername(),
				agent: sess.agent,
				provider: sess.provider,
				model: sess.model,
				createdAt: sess.createdAt,
				stats: {
					inputTokens: sess.totalInputTokens ?? 0,
					outputTokens: sess.totalOutputTokens ?? 0,
					cachedTokens: sess.totalCachedTokens ?? 0,
					cacheCreationTokens: sess.totalCacheCreationTokens ?? 0,
					reasoningTokens: sess.totalReasoningTokens ?? 0,
					toolTimeMs: sess.totalToolTimeMs ?? 0,
					toolCounts: sess.toolCountsJson
						? JSON.parse(sess.toolCountsJson)
						: {},
				},
				messages: allMessages.map((m) => ({
					id: m.id,
					role: m.role,
					createdAt: m.createdAt,
					parts: (partsByMessage.get(m.id) || []).map((p) => ({
						type: p.type,
						content: p.content,
						toolName: p.toolName,
						toolCallId: p.toolCallId,
					})),
				})),
			};

			const res = await fetch(`${SHARE_API_URL}/share`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionData,
					title: sess.title,
					lastMessageId,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				return c.json({ error: `Failed to create share: ${err}` }, 500);
			}

			const data = (await res.json()) as {
				shareId: string;
				secret: string;
				url: string;
			};

			await db.insert(shares).values({
				sessionId,
				shareId: data.shareId,
				secret: data.secret,
				url: data.url,
				title: sess.title,
				description: null,
				createdAt: Date.now(),
				lastSyncedAt: Date.now(),
				lastSyncedMessageId: lastMessageId,
			});

			return c.json({
				shared: true,
				shareId: data.shareId,
				url: data.url,
			});
		},
	);

	openApiRoute(
		app,
		{
			method: 'put',
			path: '/v1/sessions/{sessionId}/share',
			tags: ['sessions'],
			operationId: 'syncShare',
			summary: 'Sync shared session with new messages',
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
									synced: {
										type: 'boolean',
									},
									url: {
										type: 'string',
									},
									newMessages: {
										type: 'integer',
									},
									message: {
										type: 'string',
									},
								},
								required: ['synced'],
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
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const share = await db
				.select()
				.from(shares)
				.where(eq(shares.sessionId, sessionId))
				.limit(1);
			if (!share.length) {
				return c.json({ error: 'Session not shared. Use share first.' }, 400);
			}

			const session = await db
				.select()
				.from(sessions)
				.where(eq(sessions.id, sessionId))
				.limit(1);
			if (!session.length) {
				return c.json({ error: 'Session not found' }, 404);
			}

			const allMessages = await db
				.select()
				.from(messages)
				.where(eq(messages.sessionId, sessionId))
				.orderBy(messages.createdAt);

			const msgParts = await db
				.select()
				.from(messageParts)
				.where(
					inArray(
						messageParts.messageId,
						allMessages.map((m) => m.id),
					),
				)
				.orderBy(messageParts.index);

			const partsByMessage = new Map<string, typeof msgParts>();
			for (const part of msgParts) {
				const list = partsByMessage.get(part.messageId) || [];
				list.push(part);
				partsByMessage.set(part.messageId, list);
			}

			const lastSyncedIdx = allMessages.findIndex(
				(m) => m.id === share[0].lastSyncedMessageId,
			);
			const newMessages =
				lastSyncedIdx === -1
					? allMessages
					: allMessages.slice(lastSyncedIdx + 1);
			const lastMessageId =
				allMessages[allMessages.length - 1]?.id ?? share[0].lastSyncedMessageId;

			if (newMessages.length === 0) {
				return c.json({
					synced: true,
					url: share[0].url,
					newMessages: 0,
					message: 'Already synced',
				});
			}

			const sess = session[0];
			const sessionData = {
				title: sess.title,
				username: getUsername(),
				agent: sess.agent,
				provider: sess.provider,
				model: sess.model,
				createdAt: sess.createdAt,
				stats: {
					inputTokens: sess.totalInputTokens ?? 0,
					outputTokens: sess.totalOutputTokens ?? 0,
					cachedTokens: sess.totalCachedTokens ?? 0,
					cacheCreationTokens: sess.totalCacheCreationTokens ?? 0,
					reasoningTokens: sess.totalReasoningTokens ?? 0,
					toolTimeMs: sess.totalToolTimeMs ?? 0,
					toolCounts: sess.toolCountsJson
						? JSON.parse(sess.toolCountsJson)
						: {},
				},
				messages: allMessages.map((m) => ({
					id: m.id,
					role: m.role,
					createdAt: m.createdAt,
					parts: (partsByMessage.get(m.id) || []).map((p) => ({
						type: p.type,
						content: p.content,
						toolName: p.toolName,
						toolCallId: p.toolCallId,
					})),
				})),
			};

			const res = await fetch(`${SHARE_API_URL}/share/${share[0].shareId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'X-Share-Secret': share[0].secret,
				},
				body: JSON.stringify({
					sessionData,
					title: sess.title,
					lastMessageId,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				return c.json({ error: `Failed to sync share: ${err}` }, 500);
			}

			await db
				.update(shares)
				.set({
					title: sess.title,
					lastSyncedAt: Date.now(),
					lastSyncedMessageId: lastMessageId,
				})
				.where(eq(shares.sessionId, sessionId));

			return c.json({
				synced: true,
				url: share[0].url,
				newMessages: newMessages.length,
			});
		},
	);

	openApiRoute(
		app,
		{
			method: 'delete',
			path: '/v1/sessions/{sessionId}/share',
			tags: ['sessions'],
			operationId: 'deleteShare',
			summary: 'Delete a shared session',
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
									deleted: {
										type: 'boolean',
									},
									sessionId: {
										type: 'string',
									},
								},
								required: ['deleted', 'sessionId'],
							},
						},
					},
				},
				'404': {
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
			const sessionId = c.req.param('sessionId');
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const share = await db
				.select()
				.from(shares)
				.where(eq(shares.sessionId, sessionId))
				.limit(1);

			if (!share.length) {
				return c.json({ error: 'Session is not shared' }, 404);
			}

			try {
				const res = await fetch(`${SHARE_API_URL}/share/${share[0].shareId}`, {
					method: 'DELETE',
					headers: { 'X-Share-Secret': share[0].secret },
				});

				if (!res.ok && res.status !== 404) {
					const err = await res.text();
					return c.json({ error: `Failed to delete share: ${err}` }, 500);
				}
			} catch {}

			await db.delete(shares).where(eq(shares.sessionId, sessionId));

			return c.json({ deleted: true, sessionId });
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/shares',
			tags: ['sessions'],
			operationId: 'listShares',
			summary: 'List all shared sessions for a project',
			parameters: [
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
									shares: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												sessionId: {
													type: 'string',
												},
												shareId: {
													type: 'string',
												},
												url: {
													type: 'string',
												},
												title: {
													type: 'string',
													nullable: true,
												},
												createdAt: {
													type: 'integer',
												},
												lastSyncedAt: {
													type: 'integer',
												},
											},
											required: [
												'sessionId',
												'shareId',
												'url',
												'createdAt',
												'lastSyncedAt',
											],
										},
									},
								},
								required: ['shares'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const projectRoot = c.req.query('project') || process.cwd();
			const cfg = await loadConfig(projectRoot);
			const db = await getDb(cfg.projectRoot);

			const rows = await db
				.select({
					sessionId: shares.sessionId,
					shareId: shares.shareId,
					url: shares.url,
					title: shares.title,
					createdAt: shares.createdAt,
					lastSyncedAt: shares.lastSyncedAt,
				})
				.from(shares)
				.innerJoin(sessions, eq(shares.sessionId, sessions.id))
				.where(eq(sessions.projectPath, cfg.projectRoot))
				.orderBy(desc(shares.lastSyncedAt));

			return c.json({ shares: rows });
		},
	);

	// Retry a failed assistant message
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions/{sessionId}/messages/{messageId}/retry',
			tags: ['sessions'],
			operationId: 'retryMessage',
			summary: 'Retry a failed assistant message',
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
					in: 'path',
					name: 'messageId',
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
									success: {
										type: 'boolean',
									},
									messageId: {
										type: 'string',
									},
								},
								required: ['success', 'messageId'],
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
				'404': {
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
				const messageId = c.req.param('messageId');
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const db = await getDb(cfg.projectRoot);

				// Get the assistant message
				const [assistantMsg] = await db
					.select()
					.from(messages)
					.where(
						and(
							eq(messages.id, messageId),
							eq(messages.sessionId, sessionId),
							eq(messages.role, 'assistant'),
						),
					)
					.limit(1);

				if (!assistantMsg) {
					return c.json({ error: 'Message not found' }, 404);
				}

				// Only allow retry on error or complete messages
				if (
					assistantMsg.status !== 'error' &&
					assistantMsg.status !== 'complete'
				) {
					return c.json(
						{ error: 'Can only retry error or complete messages' },
						400,
					);
				}

				// Get session for context
				const [session] = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, sessionId))
					.limit(1);

				if (!session) {
					return c.json({ error: 'Session not found' }, 404);
				}

				await db
					.delete(messageParts)
					.where(
						and(
							eq(messageParts.messageId, messageId),
							or(
								eq(messageParts.type, 'error'),
								and(
									eq(messageParts.type, 'tool_call'),
									eq(messageParts.toolName, 'finish'),
								),
							),
						),
					);

				// Reset message status to pending
				await db
					.update(messages)
					.set({
						status: 'pending',
						error: null,
						errorType: null,
						errorDetails: null,
						completedAt: null,
					})
					.where(eq(messages.id, messageId));

				// Emit event so UI updates
				const { publish } = await import('../events/bus.ts');
				publish({
					type: 'message.updated',
					sessionId,
					payload: { id: messageId, status: 'pending' },
				});

				// Re-enqueue the assistant run
				const { enqueueAssistantRun } = await import(
					'../runtime/session/queue.ts'
				);
				const { runSessionLoop } = await import('../runtime/agent/runner.ts');

				const toolApprovalMode = cfg.defaults.toolApproval ?? 'dangerous';

				enqueueAssistantRun(
					{
						sessionId,
						assistantMessageId: messageId,
						agent: assistantMsg.agent ?? 'build',
						provider: (assistantMsg.provider ??
							cfg.defaults.provider) as ProviderId,
						model: assistantMsg.model ?? cfg.defaults.model,
						projectRoot: cfg.projectRoot,
						oneShot: false,
						toolApprovalMode,
					},
					runSessionLoop,
				);

				return c.json({ success: true, messageId });
			} catch (err) {
				logger.error('Failed to retry message', err);
				const errorResponse = serializeError(err);
				return c.json(errorResponse, errorResponse.error.status || 500);
			}
		},
	);
}
