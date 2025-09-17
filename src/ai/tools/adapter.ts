import type { Tool } from 'ai';
import type { DB } from '@/db/index.ts';
import { messageParts, sessions } from '@/db/schema/index.ts';
import { eq } from 'drizzle-orm';
import { publish } from '@/server/events/bus.ts';
import type { DiscoveredTool } from '@/ai/tools/loader.ts';
import { getCwd, setCwd, joinRelative } from '@/server/runtime/cwd.ts';

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
			async onInputStart(options: ToolOnInputStartOptions | undefined) {
				if (typeof base.onInputStart === 'function')
					await base.onInputStart(options);
			},
			async onInputDelta(options: ToolOnInputDeltaOptions | undefined) {
				const delta = (options as { inputTextDelta?: string } | undefined)
					?.inputTextDelta;
				// Stream tool argument deltas as events if needed (finalize handled on input available)
				publish({
					type: 'tool.delta',
					sessionId: ctx.sessionId,
					payload: { name, channel: 'input', delta },
				});
				if (typeof base.onInputDelta === 'function')
					await base.onInputDelta(options);
			},
			async onInputAvailable(options: ToolOnInputAvailableOptions | undefined) {
				const args = (options as { input?: unknown } | undefined)?.input;
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
				if (name === 'finalize') {
					const text = extractFinalizeText(args);
					if (typeof text === 'string' && text.length)
						await appendAssistantText(ctx, text);
				}
			},
			async execute(input: ToolExecuteInput, options: ToolExecuteOptions) {
				// Handle session-relative paths and cwd tools
				let res: ToolExecuteReturn | { cwd: string } | null | undefined;
				const cwd = getCwd(ctx.sessionId);
				if (name === 'fs_pwd') {
					res = { cwd };
				} else if (name === 'fs_cd') {
					const next = joinRelative(cwd, String(input?.path ?? '.'));
					setCwd(ctx.sessionId, next);
					res = { cwd: next };
				} else if (name.startsWith('fs_') && typeof input?.path === 'string') {
					const rel = joinRelative(cwd, String(input.path));
					const nextInput = { ...input, path: rel } as ToolExecuteInput;
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
							payload: { name, channel: 'output', delta: chunk },
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
					payload: contentObj,
				});
				return result;
			},
		} as Tool;
	}
	return out;
}

function extractFinalizeText(input: unknown): string | undefined {
	if (typeof input === 'string') return input;
	if (!input || typeof input !== 'object') return undefined;
	const obj = input as Record<string, unknown>;
	if (typeof obj.text === 'string') return obj.text;
	if (
		obj.input &&
		typeof (obj.input as Record<string, unknown>).text === 'string'
	)
		return String((obj.input as Record<string, unknown>).text);
	return undefined;
}

async function appendAssistantText(ctx: ToolAdapterContext, text: string) {
	try {
		const rows = await ctx.db
			.select()
			.from(messageParts)
			.where(eq(messageParts.id, ctx.assistantPartId));
		let previous = '';
		if (rows.length) {
			try {
				const parsed = JSON.parse(rows[0]?.content ?? '{}');
				if (parsed && typeof parsed.text === 'string') previous = parsed.text;
			} catch {}
		}
		const addition = text.startsWith(previous)
			? text.slice(previous.length)
			: text;
		if (addition.length) {
			publish({
				type: 'message.part.delta',
				sessionId: ctx.sessionId,
				payload: {
					messageId: ctx.messageId,
					partId: ctx.assistantPartId,
					delta: addition,
				},
			});
		}
		await ctx.db
			.update(messageParts)
			.set({ content: JSON.stringify({ text }) })
			.where(eq(messageParts.id, ctx.assistantPartId));
	} catch {
		// ignore to keep run alive if we can't persist the text
	}
}
