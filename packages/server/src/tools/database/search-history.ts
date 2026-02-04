import { tool } from 'ai';
import { z } from 'zod/v3';
import { getDb } from '@ottocode/database';
import { sessions, messages, messageParts } from '@ottocode/database/schema';
import { eq, like, and } from 'drizzle-orm';

const inputSchema = z.object({
	query: z.string().min(1).describe('Search term to find in message content'),
	limit: z
		.number()
		.min(1)
		.max(50)
		.default(20)
		.describe('Max results to return'),
});

export function buildSearchHistoryTool(projectRoot: string) {
	return {
		name: 'search_history',
		tool: tool({
			description:
				'Full-text search across all message content in session history. Find past conversations, solutions, or discussions about specific topics.',
			inputSchema,
			async execute(input) {
				const db = await getDb(projectRoot);

				const projectSessionIds = await db
					.select({ id: sessions.id })
					.from(sessions)
					.where(eq(sessions.projectPath, projectRoot));

				const sessionIdSet = new Set(projectSessionIds.map((s) => s.id));

				if (sessionIdSet.size === 0) {
					return {
						ok: true,
						results: [],
						total: 0,
					};
				}

				const searchPattern = `%${input.query}%`;

				const matchingParts = await db
					.select({
						id: messageParts.id,
						messageId: messageParts.messageId,
						content: messageParts.content,
						type: messageParts.type,
					})
					.from(messageParts)
					.where(
						and(
							eq(messageParts.type, 'text'),
							like(messageParts.content, searchPattern),
						),
					)
					.limit(input.limit * 3);

				const results: Array<{
					sessionId: string;
					sessionTitle: string | null;
					messageId: string;
					role: string;
					matchedContent: string;
					createdAt: number;
				}> = [];

				for (const part of matchingParts) {
					if (results.length >= input.limit) break;

					const msgRows = await db
						.select({
							id: messages.id,
							sessionId: messages.sessionId,
							role: messages.role,
							createdAt: messages.createdAt,
						})
						.from(messages)
						.where(eq(messages.id, part.messageId))
						.limit(1);

					if (msgRows.length === 0) continue;

					const msg = msgRows[0];

					if (!sessionIdSet.has(msg.sessionId)) continue;

					const sessionRows = await db
						.select({ title: sessions.title })
						.from(sessions)
						.where(eq(sessions.id, msg.sessionId))
						.limit(1);

					const content = part.content ?? '';
					const queryLower = input.query.toLowerCase();
					const contentLower = content.toLowerCase();
					const matchIndex = contentLower.indexOf(queryLower);

					let matchedContent: string;
					if (matchIndex >= 0) {
						const start = Math.max(0, matchIndex - 50);
						const end = Math.min(
							content.length,
							matchIndex + input.query.length + 50,
						);
						const prefix = start > 0 ? '...' : '';
						const suffix = end < content.length ? '...' : '';
						matchedContent = prefix + content.slice(start, end) + suffix;
					} else {
						matchedContent =
							content.slice(0, 150) + (content.length > 150 ? '...' : '');
					}

					results.push({
						sessionId: msg.sessionId,
						sessionTitle: sessionRows[0]?.title ?? null,
						messageId: msg.id,
						role: msg.role,
						matchedContent,
						createdAt: msg.createdAt,
					});
				}

				results.sort((a, b) => b.createdAt - a.createdAt);

				return {
					ok: true,
					results,
					total: results.length,
				};
			},
		}),
	};
}
