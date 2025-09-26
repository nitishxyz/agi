import type { Tool } from 'ai';
import { messageParts, sessions } from '@/db/schema/index.ts';
import { eq } from 'drizzle-orm';
import { publish } from '@/server/events/bus.ts';
import type { DiscoveredTool } from '@/ai/tools/loader.ts';
import { getCwd, setCwd, joinRelative } from '@/server/runtime/cwd.ts';
import {
	appendAssistantText,
	extractFinishText,
	type ToolAdapterContext,
} from '@/server/runtime/toolContext.ts';

export type { ToolAdapterContext } from '@/server/runtime/toolContext.ts';

type ToolOnInputStartOptions = Tool['onInputStart'] extends (
	options: infer Opt,
) => unknown
	? Opt
	: undefined;
type ToolOnInputDeltaOptions = Tool['onInputDelta'] extends (
	options: infer Opt,
) => unknown
	? Opt
	: undefined;
type ToolOnInputAvailableOptions = Tool['onInputAvailable'] extends (
	options: infer Opt,
) => unknown
	? Opt
	: undefined;
type ToolExecuteSignature = Tool['execute'] extends (
	input: infer Input,
	options: infer Options,
) => infer Result
	? { input: Input; options: Options; result: Result }
	: { input: unknown; options: unknown; result: unknown };
type ToolExecuteInput = ToolExecuteSignature['input'];
type ToolExecuteOptions = ToolExecuteSignature['options'] extends never
	? undefined
	: ToolExecuteSignature['options'];
type ToolExecuteReturn = ToolExecuteSignature['result'];

export function adaptTools(tools: DiscoveredTool[], ctx: ToolAdapterContext) {
	const out: Record<string, Tool> = {};
	const pendingCalls = new Map<string, { callId: string; startTs: number }[]>();
	let firstToolCallReported = false;

	for (const { name, tool } of tools) {
		const base = tool;
		out[name] = {
			...base,
			async onInputStart(options: ToolOnInputStartOptions | undefined) {
				if (typeof base.onInputStart === 'function')
					await base.onInputStart(options);
			},
			async onInputDelta(options: ToolOnInputDeltaOptions | undefined) {
				const delta = (options as { inputTextDelta?: string } | undefined)
					?.inputTextDelta;
				// Stream tool argument deltas as events if needed (finish handled on input available)
				publish({
					type: 'tool.delta',
					sessionId: ctx.sessionId,
					payload: { name, channel: 'input', delta, stepIndex: ctx.stepIndex },
				});
				if (typeof base.onInputDelta === 'function')
					await base.onInputDelta(options);
			},
			async onInputAvailable(options: ToolOnInputAvailableOptions | undefined) {
				const args = (options as { input?: unknown } | undefined)?.input;
				const callPartId = crypto.randomUUID();

				if (
					!firstToolCallReported &&
					typeof ctx.onFirstToolCall === 'function'
				) {
					firstToolCallReported = true;
					try {
						ctx.onFirstToolCall();
					} catch {}
				}

				// Special-case: progress updates must render instantly. Publish before any DB work.
				if (name === 'progress_update') {
					const startTs = Date.now();
					publish({
						type: 'tool.call',
						sessionId: ctx.sessionId,
						payload: {
							name,
							args,
							callId: callPartId,
							stepIndex: ctx.stepIndex,
						},
					});
					const list = pendingCalls.get(name) ?? [];
					list.push({ callId: callPartId, startTs });
					pendingCalls.set(name, list);
					// Optionally persist in the background without blocking ordering
					(async () => {
						try {
							const index = await ctx.nextIndex();
							await ctx.db.insert(messageParts).values({
								id: callPartId,
								messageId: ctx.messageId,
								index,
								stepIndex: ctx.stepIndex,
								type: 'tool_call',
								content: JSON.stringify({ name, args, callId: callPartId }),
								agent: ctx.agent,
								provider: ctx.provider,
								model: ctx.model,
								startedAt: startTs,
								toolName: name,
								toolCallId: callPartId,
							});
						} catch {}
					})();
					if (typeof base.onInputAvailable === 'function') {
						await base.onInputAvailable(options);
					}
					return;
				}

				// Publish promptly so UI shows the call header before results
				const startTs = Date.now();
				publish({
					type: 'tool.call',
					sessionId: ctx.sessionId,
					payload: { name, args, callId: callPartId },
				});
				const list = pendingCalls.get(name) ?? [];
				list.push({ callId: callPartId, startTs });
				pendingCalls.set(name, list);
				// Persist best-effort in the background to avoid delaying output
				(async () => {
					try {
						const index = await ctx.nextIndex();
						await ctx.db.insert(messageParts).values({
							id: callPartId,
							messageId: ctx.messageId,
							index,
							stepIndex: ctx.stepIndex,
							type: 'tool_call',
							content: JSON.stringify({ name, args, callId: callPartId }),
							agent: ctx.agent,
							provider: ctx.provider,
							model: ctx.model,
							startedAt: startTs,
							toolName: name,
							toolCallId: callPartId,
						});
					} catch {}
				})();
				if (typeof base.onInputAvailable === 'function') {
					await base.onInputAvailable(options);
				}
				if (name === 'finish') {
					const text = extractFinishText(args);
					if (typeof text === 'string' && text.length)
						await appendAssistantText(ctx, text);
				}
			},
			async execute(input: ToolExecuteInput, options: ToolExecuteOptions) {
				// Handle session-relative paths and cwd tools
				let res: ToolExecuteReturn | { cwd: string } | null | undefined;
				const cwd = getCwd(ctx.sessionId);
				if (name === 'pwd') {
					res = { cwd };
				} else if (name === 'cd') {
					const next = joinRelative(cwd, String(input?.path ?? '.'));
					setCwd(ctx.sessionId, next);
					res = { cwd: next };
				} else if (
					['read', 'write', 'ls', 'tree'].includes(name) &&
					typeof input?.path === 'string'
				) {
					const rel = joinRelative(
						cwd,
						String((input as Record<string, unknown>).path),
					);
					const nextInput = {
						...(input as Record<string, unknown>),
						path: rel,
					} as ToolExecuteInput;
					res = base.execute?.(nextInput, options);
				} else if (name === 'bash') {
					const needsCwd =
						!input ||
						typeof (input as Record<string, unknown>).cwd !== 'string';
					const nextInput = needsCwd
						? ({
								...(input as Record<string, unknown>),
								cwd,
							} as ToolExecuteInput)
						: input;
					res = base.execute?.(nextInput, options);
				} else {
					res = base.execute?.(input, options);
				}
				let result: unknown = res;
				// If tool returns an async iterable, stream deltas while accumulating
				if (res && typeof res === 'object' && Symbol.asyncIterator in res) {
					const chunks: unknown[] = [];
					for await (const chunk of res as AsyncIterable<unknown>) {
						chunks.push(chunk);
						publish({
							type: 'tool.delta',
							sessionId: ctx.sessionId,
							payload: {
								name,
								channel: 'output',
								delta: chunk,
								stepIndex: ctx.stepIndex,
							},
						});
					}
					// Prefer the last chunk as the result if present, otherwise the entire array
					result = chunks.length > 0 ? chunks[chunks.length - 1] : null;
				} else {
					// Await promise or passthrough value
					result = await Promise.resolve(res as ToolExecuteReturn);
				}
				const resultPartId = crypto.randomUUID();
				let callId: string | undefined;
				let startTs: number | undefined;
				const queue = pendingCalls.get(name);
				if (queue?.length) {
					const meta = queue.shift();
					callId = meta?.callId;
					startTs = meta?.startTs;
				}
				const contentObj: {
					name: string;
					result: unknown;
					callId?: string;
					artifact?: unknown;
				} = {
					name,
					result,
					callId,
				};
				if (result && typeof result === 'object' && 'artifact' in result) {
					try {
						const maybeArtifact = (result as { artifact?: unknown }).artifact;
						if (maybeArtifact !== undefined)
							contentObj.artifact = maybeArtifact;
					} catch {}
				}
				// If finish returns a text payload in the result, stream it as assistant text.
				try {
					if (name === 'finish' && result && typeof result === 'object') {
						const t = (result as Record<string, unknown>).text;
						if (typeof t === 'string' && t.trim().length) {
							await appendAssistantText(ctx, t);
						}
					}
				} catch {}

				const index = await ctx.nextIndex();
				const endTs = Date.now();
				const dur =
					typeof startTs === 'number' ? Math.max(0, endTs - startTs) : null;

				// Special-case: keep progress_update result lightweight; publish first, persist best-effort
				if (name === 'progress_update') {
					publish({
						type: 'tool.result',
						sessionId: ctx.sessionId,
						payload: { ...contentObj, stepIndex: ctx.stepIndex },
					});
					// Persist without blocking the event loop
					(async () => {
						try {
							await ctx.db.insert(messageParts).values({
								id: resultPartId,
								messageId: ctx.messageId,
								index,
								stepIndex: ctx.stepIndex,
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
						} catch {}
					})();
					return result as ToolExecuteReturn;
				}

				await ctx.db.insert(messageParts).values({
					id: resultPartId,
					messageId: ctx.messageId,
					index,
					stepIndex: ctx.stepIndex,
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
						const row = sessRows[0] as typeof sessions.$inferSelect;
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
					payload: { ...contentObj, stepIndex: ctx.stepIndex },
				});
				if (name === 'update_plan') {
					try {
						const result = (contentObj as { result?: unknown }).result as
							| { items?: unknown; note?: unknown }
							| undefined;
						if (result && Array.isArray(result.items)) {
							publish({
								type: 'plan.updated',
								sessionId: ctx.sessionId,
								payload: { items: result.items, note: result.note },
							});
						}
					} catch {}
				}
				return result;
			},
		} as Tool;
	}
	return out;
}
