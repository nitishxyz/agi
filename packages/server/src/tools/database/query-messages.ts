import { tool } from 'ai';
import { z } from 'zod';
import { getDb } from '@agi-cli/database';
import { sessions, messages, messageParts } from '@agi-cli/database/schema';
import { eq, desc, asc, gte, lte, and, like, count, sql } from 'drizzle-orm';

const inputSchema = z.object({
	sessionId: z.string().optional().describe('Filter by specific session ID'),
	role: z
		.enum(['user', 'assistant', 'system', 'tool'])
		.optional()
		.describe('Filter by message role'),
	search: z.string().optional().describe('Full-text search in message content'),
	toolName: z
		.string()
		.optional()
		.describe('Filter by tool calls with this name'),
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(50)
		.describe('Max messages to return'),
	offset: z.number().min(0).default(0).describe('Offset for pagination'),
	startDate: z
		.string()
		.optional()
		.describe('Filter messages created after this ISO date'),
	endDate: z
		.string()
		.optional()
		.describe('Filter messages created before this ISO date'),
});

export function buildQueryMessagesTool(projectRoot: string) {
	return {
		name: 'query_messages',
		tool: tool({
			description:
				'Search messages across sessions. Find specific conversations, tool calls, or content patterns in session history.',
			inputSchema,
			async execute(input) {
				const db = await getDb(projectRoot);

				const conditions = [];

				if (input.sessionId) {
					conditions.push(eq(messages.sessionId, input.sessionId));
				} else {
					const projectSessions = db
						.select({ id: sessions.id })
						.from(sessions)
						.where(eq(sessions.projectPath, projectRoot));
					conditions.push(
						sql`${messages.sessionId} IN (SELECT id FROM sessions WHERE project_path = ${projectRoot})`,
					);
				}

				if (input.role) {
					conditions.push(eq(messages.role, input.role));
				}

				if (input.startDate) {
					const startTs = new Date(input.startDate).getTime();
					conditions.push(gte(messages.createdAt, startTs));
				}

				if (input.endDate) {
					const endTs = new Date(input.endDate).getTime();
					conditions.push(lte(messages.createdAt, endTs));
				}

				const rows = await db
					.select({
						id: messages.id,
						sessionId: messages.sessionId,
						role: messages.role,
						agent: messages.agent,
						model: messages.model,
						createdAt: messages.createdAt,
						totalTokens: messages.totalTokens,
						status: messages.status,
					})
					.from(messages)
					.where(conditions.length > 0 ? and(...conditions) : undefined)
					.orderBy(desc(messages.createdAt))
					.limit(input.limit * 2)
					.offset(input.offset);

				const messagesWithContent = await Promise.all(
					rows.map(async (msg) => {
						const parts = await db
							.select({
								type: messageParts.type,
								content: messageParts.content,
								toolName: messageParts.toolName,
							})
							.from(messageParts)
							.where(eq(messageParts.messageId, msg.id))
							.orderBy(asc(messageParts.index))
							.limit(10);

						let contentPreview = '';
						let hasMatchingTool = false;

						for (const part of parts) {
							if (part.type === 'text' && part.content) {
								contentPreview = part.content.slice(0, 300);
							}
							if (input.toolName && part.toolName === input.toolName) {
								hasMatchingTool = true;
							}
						}

						if (input.toolName && !hasMatchingTool) {
							return null;
						}

						if (
							input.search &&
							!contentPreview.toLowerCase().includes(input.search.toLowerCase())
						) {
							return null;
						}

						const session = await db
							.select({ title: sessions.title })
							.from(sessions)
							.where(eq(sessions.id, msg.sessionId))
							.limit(1);

						return {
							...msg,
							sessionTitle: session[0]?.title ?? null,
							contentPreview: contentPreview.slice(0, 200),
						};
					}),
				);

				const filtered = messagesWithContent.filter(
					(m): m is NonNullable<typeof m> => m !== null,
				);
				const limited = filtered.slice(0, input.limit);

				const countResult = await db
					.select({ total: count() })
					.from(messages)
					.where(conditions.length > 0 ? and(...conditions) : undefined);

				return {
					ok: true,
					messages: limited,
					total: countResult[0]?.total ?? 0,
					limit: input.limit,
					offset: input.offset,
				};
			},
		}),
	};
}
