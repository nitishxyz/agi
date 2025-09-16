import type { Tool } from 'ai';
import type { DB } from '@/db/index.ts';
import { messageParts, sessions } from '@/db/schema/index.ts';
import { eq } from 'drizzle-orm';
import { publish } from '@/server/events/bus.ts';
import type { DiscoveredTool } from '@/ai/tools/loader.ts';
import { getCwd, setCwd, joinRelative } from '@/server/runtime/cwd.ts';

export type ToolAdapterContext = {
	sessionId: string;
	messageId: string; // assistant message id to attach parts to
	assistantPartId: string;
	db: DB;
	agent: string;
	provider: string;
	model: string;
	projectRoot: string;
	// Monotonic index allocator shared across runner + tools for this message
	nextIndex: () => number | Promise<number>;
};

export function adaptTools(tools: DiscoveredTool[], ctx: ToolAdapterContext) {
	const out: Record<string, Tool> = {};
	const pendingCalls = new Map<string, { callId: string; startTs: number }[]>();

	for (const { name, tool } of tools) {
		const base = tool;
		out[name] = {
			...base,
			async onInputStart(options: any) {
				if (typeof base.onInputStart === 'function')
					await base.onInputStart(options);
			},
			async onInputDelta(options: any) {
				const delta = options?.inputTextDelta;
				// Special handling: if finalize is streaming a 'text' input, treat it as assistant text delta
				if (name === 'finalize' && typeof delta === 'string' && delta.length) {
					publish({
						type: 'message.part.delta',
						sessionId: ctx.sessionId,
						payload: {
							messageId: ctx.messageId,
							partId: ctx.assistantPartId,
							delta,
						},
					});
					try {
						// Append to the assistant text part content
						const rows = await ctx.db
							.select()
							.from(messageParts)
							.where(eq(messageParts.id, ctx.assistantPartId));
						if (rows.length) {
							const current = rows[0];
							let obj = { text: '' as string };
							try {
								obj = JSON.parse(current.content || '{}');
							} catch {}
							obj.text = String((obj.text || '') + delta);
							await ctx.db
								.update(messageParts)
								.set({ content: JSON.stringify(obj) })
								.where(eq(messageParts.id, ctx.assistantPartId));
						}
					} catch {}
				} else {
					// Stream tool argument deltas as events if needed
					publish({
						type: 'tool.delta',
						sessionId: ctx.sessionId,
						payload: { name, channel: 'input', delta },
					});
					if (typeof base.onInputDelta === 'function')
						await base.onInputDelta(options);
				}
			},
			async onInputAvailable(options: any) {
				const args = options?.input;
				const callPartId = crypto.randomUUID();
				// Allocate index and persist before publishing the event to ensure deterministic ordering
				const index = await ctx.nextIndex();
				const startTs = Date.now();
				await ctx.db.insert(messageParts).values({
					id: callPartId,
					messageId: ctx.messageId,
					index,
					type: 'tool_call',
					content: JSON.stringify({ name, args, callId: callPartId }),
					agent: ctx.agent,
					provider: ctx.provider,
					model: ctx.model,
					startedAt: startTs,
					toolName: name,
					toolCallId: callPartId,
				});
				publish({
					type: 'tool.call',
					sessionId: ctx.sessionId,
					payload: { name, args, callId: callPartId },
				});
				const list = pendingCalls.get(name) ?? [];
				list.push({ callId: callPartId, startTs });
				pendingCalls.set(name, list);
				if (typeof base.onInputAvailable === 'function') {
					await base.onInputAvailable(options);
				}
			},
			async execute(input: any, options: any) {
				// Handle session-relative paths and cwd tools
				let res: any;
				const cwd = getCwd(ctx.sessionId);
				if (name === 'fs_pwd') {
					res = { cwd };
				} else if (name === 'fs_cd') {
					const next = joinRelative(cwd, String(input?.path ?? '.'));
					setCwd(ctx.sessionId, next);
					res = { cwd: next };
				} else if (name.startsWith('fs_') && typeof input?.path === 'string') {
					const rel = joinRelative(cwd, String(input.path));
					input = { ...input, path: rel };
					res = (base as any).execute?.(input, options);
				} else {
					res = (base as any).execute?.(input, options);
				}
				let result: any = res;
				// If tool returns an async iterable, stream deltas while accumulating
				if (res && typeof res === 'object' && Symbol.asyncIterator in res) {
					const chunks: any[] = [];
					for await (const chunk of res as AsyncIterable<any>) {
						chunks.push(chunk);
						publish({
							type: 'tool.delta',
							sessionId: ctx.sessionId,
							payload: { name, channel: 'output', delta: chunk },
						});
					}
					// Prefer the last chunk as the result if present, otherwise the entire array
					result = chunks.length > 0 ? chunks[chunks.length - 1] : null;
				} else {
					// Await promise or passthrough value
					result = await res;
				}
				const resultPartId = crypto.randomUUID();
				let callId: string | undefined;
				let startTs: number | undefined;
				const queue = pendingCalls.get(name);
				if (queue && queue.length) {
					const meta = queue.shift();
					callId = meta?.callId;
					startTs = meta?.startTs;
				}
				const contentObj: any = { name, result, callId };
				if (result && typeof result === 'object' && 'artifact' in result) {
					try {
						contentObj.artifact = (result as any).artifact;
					} catch {}
				}
				const index = await ctx.nextIndex();
				const endTs = Date.now();
				const dur =
					typeof startTs === 'number' ? Math.max(0, endTs - startTs) : null;
				await ctx.db.insert(messageParts).values({
					id: resultPartId,
					messageId: ctx.messageId,
					index,
					type: 'tool_result',
					content: JSON.stringify(contentObj),
					agent: ctx.agent,
					provider: ctx.provider,
					model: ctx.model,
					startedAt: startTs,
					completedAt: endTs,
					toolName: name,
					toolCallId: callId,
					toolDurationMs: dur ?? undefined,
				});
				// Update session aggregates: total tool time and counts per tool
				try {
					const sessRows = await ctx.db
						.select()
						.from(sessions)
						.where(eq(sessions.id, ctx.sessionId));
					if (sessRows.length) {
						const row = sessRows[0] as any;
						const totalToolTimeMs =
							Number(row.totalToolTimeMs || 0) + (dur ?? 0);
						let counts: Record<string, number> = {};
						try {
							counts = row.toolCountsJson ? JSON.parse(row.toolCountsJson) : {};
						} catch {}
						counts[name] = (counts[name] || 0) + 1;
						await ctx.db
							.update(sessions)
							.set({
								totalToolTimeMs,
								toolCountsJson: JSON.stringify(counts),
								lastActiveAt: endTs,
							})
							.where(eq(sessions.id, ctx.sessionId));
					}
				} catch {}
				publish({
					type: 'tool.result',
					sessionId: ctx.sessionId,
					payload: contentObj,
				});
				return result;
			},
		} as Tool;
	}
	return out;
}
