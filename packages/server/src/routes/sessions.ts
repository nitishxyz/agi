import type { Hono } from 'hono';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { sessions, messages, messageParts } from '@agi-cli/database/schema';
import { desc, eq, and, inArray } from 'drizzle-orm';
import type { ProviderId } from '@agi-cli/sdk';
import { isProviderId, catalog } from '@agi-cli/sdk';
import { resolveAgentConfig } from '../runtime/agent-registry.ts';
import { createSession as createSessionRow } from '../runtime/session-manager.ts';
import { serializeError } from '../runtime/api-error.ts';
import { logger } from '@agi-cli/sdk';

export function registerSessionsRoutes(app: Hono) {
	// List sessions
	app.get('/v1/sessions', async (c) => {
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		// Only return sessions for this project
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.projectPath, cfg.projectRoot))
			.orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt));
		const normalized = rows.map((r) => {
			let counts: Record<string, unknown> | undefined;
			if (r.toolCountsJson) {
				try {
					const parsed = JSON.parse(r.toolCountsJson);
					if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
						counts = parsed as Record<string, unknown>;
					}
				} catch {}
			}
			const { toolCountsJson: _toolCountsJson, ...rest } = r;
			return counts ? { ...rest, toolCounts: counts } : rest;
		});
		return c.json(normalized);
	});

	// Create session
	app.post('/v1/sessions', async (c) => {
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
			if (providerCandidate && isProviderId(providerCandidate))
				return providerCandidate;
			if (agentCfg.provider && isProviderId(agentCfg.provider))
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
	});

	// Update session preferences
	app.patch('/v1/sessions/:sessionId', async (c) => {
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
				lastActiveAt?: number;
			} = {
				lastActiveAt: Date.now(),
			};

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
				if (providerName && isProviderId(providerName)) {
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

					// Check if model exists for the provider
					const providerCatalog = catalog[targetProvider];
					if (providerCatalog) {
						const modelExists = providerCatalog.models.some(
							(m) => m.id === modelName,
						);
						if (!modelExists) {
							return c.json(
								{
									error: `Model "${modelName}" not found for provider "${targetProvider}"`,
								},
								400,
							);
						}
					}

					updates.model = modelName;
				}
			}

			// Perform update
			await db.update(sessions).set(updates).where(eq(sessions.id, sessionId));

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
	});

	// Abort session stream
	app.delete('/v1/sessions/:sessionId/abort', async (c) => {
		const sessionId = c.req.param('sessionId');
		const body = (await c.req.json().catch(() => ({}))) as Record<
			string,
			unknown
		>;
		const messageId =
			typeof body.messageId === 'string' ? body.messageId : undefined;
		const clearQueue = body.clearQueue === true;

		const { abortSession, abortMessage } = await import('../runtime/runner.ts');

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
	});

	// Get queue state for a session
	app.get('/v1/sessions/:sessionId/queue', async (c) => {
		const sessionId = c.req.param('sessionId');
		const { getQueueState } = await import('../runtime/session-queue.ts');
		const state = getQueueState(sessionId);
		return c.json(
			state ?? {
				currentMessageId: null,
				queuedMessages: [],
				isRunning: false,
			},
		);
	});

	// Remove a message from the queue
	app.delete('/v1/sessions/:sessionId/queue/:messageId', async (c) => {
		const sessionId = c.req.param('sessionId');
		const messageId = c.req.param('messageId');
		const projectRoot = c.req.query('project') || process.cwd();
		const cfg = await loadConfig(projectRoot);
		const db = await getDb(cfg.projectRoot);
		const { removeFromQueue, abortMessage } = await import(
			'../runtime/session-queue.ts'
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
							and(eq(messages.sessionId, sessionId), eq(messages.role, 'user')),
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

		return c.json({ success: false, removed: false }, 404);
	});
}
