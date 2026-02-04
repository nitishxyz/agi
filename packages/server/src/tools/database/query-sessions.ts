import { tool } from 'ai';
import { z } from 'zod/v3';
import { getDb } from '@ottocode/database';
import { sessions, messages } from '@ottocode/database/schema';
import { eq, desc, asc, gte, lte, and, count } from 'drizzle-orm';

const inputSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(100)
		.default(20)
		.describe('Max sessions to return'),
	offset: z.number().min(0).default(0).describe('Offset for pagination'),
	agent: z.string().optional().describe('Filter by agent type'),
	startDate: z
		.string()
		.optional()
		.describe('Filter sessions created after this ISO date'),
	endDate: z
		.string()
		.optional()
		.describe('Filter sessions created before this ISO date'),
	orderBy: z
		.enum(['created_at', 'last_active_at', 'total_tokens'])
		.default('last_active_at')
		.describe('Sort field'),
	orderDir: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
	sessionType: z
		.enum(['main', 'research', 'all'])
		.default('main')
		.describe('Filter by session type'),
});

export function buildQuerySessionsTool(projectRoot: string) {
	return {
		name: 'query_sessions',
		tool: tool({
			description:
				'Search and list sessions from the local database. Use to find past conversations, check what work was done, or locate specific sessions.',
			inputSchema,
			async execute(input) {
				const db = await getDb(projectRoot);

				const conditions = [eq(sessions.projectPath, projectRoot)];

				if (input.sessionType !== 'all') {
					conditions.push(eq(sessions.sessionType, input.sessionType));
				}

				if (input.agent) {
					conditions.push(eq(sessions.agent, input.agent));
				}

				if (input.startDate) {
					const startTs = new Date(input.startDate).getTime();
					conditions.push(gte(sessions.createdAt, startTs));
				}

				if (input.endDate) {
					const endTs = new Date(input.endDate).getTime();
					conditions.push(lte(sessions.createdAt, endTs));
				}

				const orderField =
					input.orderBy === 'created_at'
						? sessions.createdAt
						: input.orderBy === 'total_tokens'
							? sessions.totalInputTokens
							: sessions.lastActiveAt;

				const orderFn = input.orderDir === 'asc' ? asc : desc;

				const rows = await db
					.select({
						id: sessions.id,
						title: sessions.title,
						agent: sessions.agent,
						provider: sessions.provider,
						model: sessions.model,
						createdAt: sessions.createdAt,
						lastActiveAt: sessions.lastActiveAt,
						totalInputTokens: sessions.totalInputTokens,
						totalOutputTokens: sessions.totalOutputTokens,
						totalCachedTokens: sessions.totalCachedTokens,
						totalCacheCreationTokens: sessions.totalCacheCreationTokens,
						sessionType: sessions.sessionType,
						parentSessionId: sessions.parentSessionId,
					})
					.from(sessions)
					.where(and(...conditions))
					.orderBy(orderFn(orderField), desc(sessions.createdAt))
					.limit(input.limit)
					.offset(input.offset);

				const countResult = await db
					.select({ total: count() })
					.from(sessions)
					.where(and(...conditions));

				const total = countResult[0]?.total ?? 0;

				const sessionsWithCounts = await Promise.all(
					rows.map(async (row) => {
						const msgCount = await db
							.select({ count: count() })
							.from(messages)
							.where(eq(messages.sessionId, row.id));
						return {
							...row,
							messageCount: msgCount[0]?.count ?? 0,
						};
					}),
				);

				return {
					ok: true,
					sessions: sessionsWithCounts,
					total,
					limit: input.limit,
					offset: input.offset,
				};
			},
		}),
	};
}
