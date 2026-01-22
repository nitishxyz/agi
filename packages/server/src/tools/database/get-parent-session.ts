import { tool } from 'ai';
import { z } from 'zod';
import { getDb } from '@agi-cli/database';
import { sessions, messages, messageParts } from '@agi-cli/database/schema';
import { eq, asc, count } from 'drizzle-orm';

const inputSchema = z.object({
	includeMessages: z
		.boolean()
		.default(true)
		.describe('Include message content from the parent session'),
	messageLimit: z
		.number()
		.min(1)
		.max(100)
		.default(50)
		.describe('Max messages to include'),
});

export function buildGetParentSessionTool(
	projectRoot: string,
	parentSessionId: string | null,
) {
	return {
		name: 'get_parent_session',
		tool: tool({
			description:
				'Get the context of the parent session that this research session is attached to. Use this to understand what the user was working on and what they might be asking about. This is the FIRST tool you should call when the user asks about "this session" or "current work".',
			inputSchema,
			async execute(input) {
				if (!parentSessionId) {
					return {
						ok: false,
						error:
							'No parent session - this research session is not attached to a main session',
					};
				}

				const db = await getDb(projectRoot);

				const sessionRows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.id, parentSessionId))
					.limit(1);

				if (sessionRows.length === 0) {
					return {
						ok: false,
						error: 'Parent session not found',
					};
				}

				const session = sessionRows[0];

				const msgCountResult = await db
					.select({ count: count() })
					.from(messages)
					.where(eq(messages.sessionId, parentSessionId));

				const toolCallsResult = await db
					.select({
						toolName: messageParts.toolName,
						count: count(),
					})
					.from(messageParts)
					.innerJoin(messages, eq(messageParts.messageId, messages.id))
					.where(eq(messages.sessionId, parentSessionId))
					.groupBy(messageParts.toolName);

				const uniqueTools: string[] = [];
				let totalToolCalls = 0;
				for (const row of toolCallsResult) {
					if (row.toolName) {
						uniqueTools.push(row.toolName);
						totalToolCalls += Number(row.count);
					}
				}

				const totalTokens =
					(session.totalInputTokens ?? 0) + (session.totalOutputTokens ?? 0);

				const stats = {
					totalMessages: msgCountResult[0]?.count ?? 0,
					totalToolCalls,
					uniqueTools,
					totalTokens,
					totalInputTokens: session.totalInputTokens ?? 0,
					totalOutputTokens: session.totalOutputTokens ?? 0,
				};

				let messagesData:
					| Array<{
							id: string;
							role: string;
							content: string;
							toolCalls?: Array<{ name: string; args?: string }>;
							createdAt: number;
					  }>
					| undefined;

				if (input.includeMessages) {
					const msgRows = await db
						.select({
							id: messages.id,
							role: messages.role,
							createdAt: messages.createdAt,
						})
						.from(messages)
						.where(eq(messages.sessionId, parentSessionId))
						.orderBy(asc(messages.createdAt))
						.limit(input.messageLimit);

					messagesData = await Promise.all(
						msgRows.map(async (msg) => {
							const parts = await db
								.select({
									type: messageParts.type,
									content: messageParts.content,
									toolName: messageParts.toolName,
								})
								.from(messageParts)
								.where(eq(messageParts.messageId, msg.id))
								.orderBy(asc(messageParts.index));

							let textContent = '';
							const toolCalls: Array<{ name: string; args?: string }> = [];

							for (const part of parts) {
								if (part.type === 'text' && part.content) {
									try {
										const parsed = JSON.parse(part.content);
										if (parsed?.text) {
											textContent += parsed.text + '\n';
										} else {
											textContent += part.content + '\n';
										}
									} catch {
										textContent += part.content + '\n';
									}
								}
								if (part.type === 'tool_call' && part.toolName) {
									toolCalls.push({
										name: part.toolName,
										args: part.content?.slice(0, 200),
									});
								}
							}

							return {
								id: msg.id,
								role: msg.role,
								content: textContent.trim().slice(0, 2000),
								...(toolCalls.length > 0 ? { toolCalls } : {}),
								createdAt: msg.createdAt,
							};
						}),
					);
				}

				return {
					ok: true,
					parentSession: {
						id: session.id,
						title: session.title,
						agent: session.agent,
						provider: session.provider,
						model: session.model,
						createdAt: session.createdAt,
						lastActiveAt: session.lastActiveAt,
					},
					stats,
					...(messagesData ? { messages: messagesData } : {}),
				};
			},
		}),
	};
}
