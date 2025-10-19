import type { Tool } from 'ai';
import { messageParts, sessions } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { publish } from '../events/bus.ts';
import type { DiscoveredTool } from '@agi-cli/sdk';
import { getCwd, setCwd, joinRelative } from '../runtime/cwd.ts';
import type {
	ToolAdapterContext,
	StepExecutionState,
} from '../runtime/tool-context.ts';
import { isToolError } from '@agi-cli/sdk/tools/error';

function isSkippedToolCallError(error: unknown): boolean {
	if (!isToolError(error)) return false;
	const details = (error as { details?: unknown }).details;
	if (!details || typeof details !== 'object') return false;
	return 'skippedTool' in (details as Record<string, unknown>);
}

export type { ToolAdapterContext } from '../runtime/tool-context.ts';

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

type PendingCallMeta = {
	callId: string;
	startTs: number;
	stepIndex?: number;
	args?: unknown;
};

function getPendingQueue(
	map: Map<string, PendingCallMeta[]>,
	name: string,
): PendingCallMeta[] {
	let queue = map.get(name);
	if (!queue) {
		queue = [];
		map.set(name, queue);
	}
	return queue;
}

export function adaptTools(
	tools: DiscoveredTool[],
	ctx: ToolAdapterContext,
	provider?: string,
) {
	const out: Record<string, Tool> = {};
	const pendingCalls = new Map<string, PendingCallMeta[]>();
	const failureState: { active: boolean; toolName?: string } = {
		active: false,
		toolName: undefined,
	};
	let firstToolCallReported = false;

	if (!ctx.stepExecution) {
		ctx.stepExecution = { states: new Map<number, StepExecutionState>() };
	}
	const stepStates = ctx.stepExecution.states;

	// Anthropic allows max 4 cache_control blocks
	// Cache only the most frequently used tools: read, write, bash
	const cacheableTools = new Set(['read', 'write', 'bash', 'edit']);
	let cachedToolCount = 0;

	for (const { name, tool } of tools) {
		const base = tool;

		const processedToolErrors = new WeakSet<object>();

		const persistToolErrorResult = async (
			errorResult: unknown,
			{
				callId,
				startTs,
				stepIndexForEvent,
				args,
			}: {
				callId?: string;
				startTs?: number;
				stepIndexForEvent: number;
				args?: unknown;
			},
		) => {
			const resultPartId = crypto.randomUUID();
			const endTs = Date.now();
			const dur =
				typeof startTs === 'number' ? Math.max(0, endTs - startTs) : null;

			const contentObj: {
				name: string;
				result: unknown;
				callId?: string;
				args?: unknown;
			} = {
				name,
				result: errorResult,
				callId,
			};

			if (args !== undefined) {
				contentObj.args = args;
			}

			const index = await ctx.nextIndex();

			await ctx.db.insert(messageParts).values({
				id: resultPartId,
				messageId: ctx.messageId,
				index,
				stepIndex: stepIndexForEvent,
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

			publish({
				type: 'tool.result',
				sessionId: ctx.sessionId,
				payload: { ...contentObj, stepIndex: stepIndexForEvent },
			});
		};

		// Add cache control for Anthropic to cache tool definitions (max 2 tools)
		const shouldCache =
			provider === 'anthropic' &&
			cacheableTools.has(name) &&
			cachedToolCount < 2;

		if (shouldCache) {
			cachedToolCount++;
		}

		const providerOptions = shouldCache
			? { anthropic: { cacheControl: { type: 'ephemeral' as const } } }
			: undefined;

		out[name] = {
			...base,
			...(providerOptions ? { providerOptions } : {}),
			async onInputStart(options: unknown) {
				const queue = getPendingQueue(pendingCalls, name);
				queue.push({
					callId: crypto.randomUUID(),
					startTs: Date.now(),
					stepIndex: ctx.stepIndex,
				});
				if (typeof base.onInputStart === 'function')
					// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
					await base.onInputStart(options as any);
			},
			async onInputDelta(options: unknown) {
				const delta = (options as { inputTextDelta?: string } | undefined)
					?.inputTextDelta;
				const queue = pendingCalls.get(name);
				const meta = queue?.length ? queue[queue.length - 1] : undefined;
				// Stream tool argument deltas as events if needed
				publish({
					type: 'tool.delta',
					sessionId: ctx.sessionId,
					payload: {
						name,
						channel: 'input',
						delta,
						stepIndex: meta?.stepIndex ?? ctx.stepIndex,
						callId: meta?.callId,
					},
				});
				if (typeof base.onInputDelta === 'function')
					// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
					await base.onInputDelta(options as any);
			},
			async onInputAvailable(options: unknown) {
				const args = (options as { input?: unknown } | undefined)?.input;
				const queue = getPendingQueue(pendingCalls, name);
				let meta = queue.length ? queue[queue.length - 1] : undefined;
				if (!meta) {
					meta = {
						callId: crypto.randomUUID(),
						startTs: Date.now(),
						stepIndex: ctx.stepIndex,
					};
					queue.push(meta);
				}
				meta.stepIndex = ctx.stepIndex;
				meta.args = args;
				const callId = meta.callId;
				const callPartId = crypto.randomUUID();
				const startTs = meta.startTs;

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
					publish({
						type: 'tool.call',
						sessionId: ctx.sessionId,
						payload: {
							name,
							args,
							callId,
							stepIndex: ctx.stepIndex,
						},
					});
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
								content: JSON.stringify({ name, args, callId }),
								agent: ctx.agent,
								provider: ctx.provider,
								model: ctx.model,
								startedAt: startTs,
								toolName: name,
								toolCallId: callId,
							});
						} catch {}
					})();
					if (typeof base.onInputAvailable === 'function') {
						// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
						await base.onInputAvailable(options as any);
					}
					return;
				}

				// Publish promptly so UI shows the call header before results
				publish({
					type: 'tool.call',
					sessionId: ctx.sessionId,
					payload: { name, args, callId, stepIndex: ctx.stepIndex },
				});
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
							content: JSON.stringify({ name, args, callId }),
							agent: ctx.agent,
							provider: ctx.provider,
							model: ctx.model,
							startedAt: startTs,
							toolName: name,
							toolCallId: callId,
						});
					} catch {}
				})();
				if (typeof base.onInputAvailable === 'function') {
					// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
					await base.onInputAvailable(options as any);
				}
			},
			async execute(input: ToolExecuteInput, options: ToolExecuteOptions) {
				const queue = pendingCalls.get(name);
				const meta = queue?.shift();
				if (queue && queue.length === 0) pendingCalls.delete(name);
				const callIdFromQueue = meta?.callId;
				const startTsFromQueue = meta?.startTs;
				const stepIndexForEvent = meta?.stepIndex ?? ctx.stepIndex;

				const stepKey =
					typeof stepIndexForEvent === 'number' &&
					Number.isFinite(stepIndexForEvent)
						? stepIndexForEvent
						: 0;
				let stepState = stepStates.get(stepKey);
				if (!stepState) {
					stepState = {
						chain: Promise.resolve(),
						failed: false,
						failedToolName: undefined,
					};
					stepStates.set(stepKey, stepState);
				}

				const executeWithGuards = async (): Promise<ToolExecuteReturn> => {
					try {
						if (failureState.active) {
							const expectedTool = failureState.toolName;
							if (!expectedTool || expectedTool !== name) {
								const skipError = {
									ok: false,
									error: expectedTool
										? `Cannot execute "${name}" because "${expectedTool}" failed earlier in this step. Retry "${expectedTool}" before using other tools.`
										: `Cannot execute "${name}" because a previous tool call in this session failed. Retry that tool before continuing with "${name}".`,
									details: {
										skippedTool: name,
										reason: 'previous_tool_failed',
										expectedTool,
									},
								};
								throw skipError;
							}
						}
						// Handle session-relative paths and cwd tools
						let res: ToolExecuteReturn | { cwd: string } | null | undefined;
						const cwd = getCwd(ctx.sessionId);
						if (name === 'pwd') {
							res = { cwd };
						} else if (name === 'cd') {
							const next = joinRelative(
								cwd,
								String((input as Record<string, unknown>)?.path ?? '.'),
							);
							setCwd(ctx.sessionId, next);
							res = { cwd: next };
						} else if (
							['read', 'write', 'ls', 'tree'].includes(name) &&
							typeof (input as Record<string, unknown>)?.path === 'string'
						) {
							const rel = joinRelative(
								cwd,
								String((input as Record<string, unknown>).path),
							);
							const nextInput = {
								...(input as Record<string, unknown>),
								path: rel,
							} as ToolExecuteInput;
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
							res = base.execute?.(nextInput, options as any);
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
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
							res = base.execute?.(nextInput, options as any);
						} else {
							// biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex
							res = base.execute?.(input, options as any);
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
										stepIndex: stepIndexForEvent,
										callId: callIdFromQueue,
									},
								});
							}
							// Prefer the last chunk as the result if present, otherwise the entire array
							result = chunks.length > 0 ? chunks[chunks.length - 1] : null;
						} else {
							// Await promise or passthrough value
							result = await Promise.resolve(res as ToolExecuteReturn);
						}

						if (isToolError(result)) {
							stepState.failed = true;
							await persistToolErrorResult(result, {
								callId: callIdFromQueue,
								startTs: startTsFromQueue,
								stepIndexForEvent,
								args: meta?.args,
							});
							processedToolErrors.add(result as object);
							throw result;
						}

						const resultPartId = crypto.randomUUID();
						const callId = callIdFromQueue;
						const startTs = startTsFromQueue;
						const contentObj: {
							name: string;
							result: unknown;
							callId?: string;
							artifact?: unknown;
							args?: unknown;
						} = {
							name,
							result,
							callId,
						};
						if (meta?.args !== undefined) {
							contentObj.args = meta.args;
						}
						if (result && typeof result === 'object' && 'artifact' in result) {
							try {
								const maybeArtifact = (result as { artifact?: unknown })
									.artifact;
								if (maybeArtifact !== undefined)
									contentObj.artifact = maybeArtifact;
							} catch {}
						}

						const index = await ctx.nextIndex();
						const endTs = Date.now();
						const dur =
							typeof startTs === 'number' ? Math.max(0, endTs - startTs) : null;

						// Special-case: keep progress_update result lightweight; publish first, persist best-effort
						if (name === 'progress_update') {
							stepState.failed = false;
							stepState.failedToolName = undefined;
							if (failureState.active && failureState.toolName === name) {
								failureState.active = false;
								failureState.toolName = undefined;
							}
							publish({
								type: 'tool.result',
								sessionId: ctx.sessionId,
								payload: { ...contentObj, stepIndex: stepIndexForEvent },
							});
							// Persist without blocking the event loop
							(async () => {
								try {
									await ctx.db.insert(messageParts).values({
										id: resultPartId,
										messageId: ctx.messageId,
										index,
										stepIndex: stepIndexForEvent,
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

						stepState.failed = false;
						stepState.failedToolName = undefined;
						if (failureState.active && failureState.toolName === name) {
							failureState.active = false;
							failureState.toolName = undefined;
						}

						await ctx.db.insert(messageParts).values({
							id: resultPartId,
							messageId: ctx.messageId,
							index,
							stepIndex: stepIndexForEvent,
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
									counts = row.toolCountsJson
										? JSON.parse(row.toolCountsJson)
										: {};
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
							payload: { ...contentObj, stepIndex: stepIndexForEvent },
						});
						if (name === 'update_plan') {
							try {
								const resultValue = (contentObj as { result?: unknown })
									.result as { items?: unknown; note?: unknown } | undefined;
								if (resultValue && Array.isArray(resultValue.items)) {
									publish({
										type: 'plan.updated',
										sessionId: ctx.sessionId,
										payload: {
											items: resultValue.items,
											note: resultValue.note,
										},
									});
								}
							} catch {}
						}
						return result as ToolExecuteReturn;
					} catch (error) {
						if (isSkippedToolCallError(error)) {
							throw error;
						}

						stepState.failed = true;
						stepState.failedToolName = name;
						failureState.active = true;
						failureState.toolName = name;

						// Tool execution failed
						if (
							isToolError(error) &&
							processedToolErrors.has(error as object)
						) {
							throw error;
						}

						const errorResult = isToolError(error)
							? error
							: (() => {
									const errorMessage =
										error instanceof Error ? error.message : String(error);
									const errorStack =
										error instanceof Error ? error.stack : undefined;
									return {
										ok: false,
										error: errorMessage,
										stack: errorStack,
									};
								})();

						await persistToolErrorResult(errorResult, {
							callId: callIdFromQueue,
							startTs: startTsFromQueue,
							stepIndexForEvent,
							args: meta?.args,
						});

						if (isToolError(error)) {
							processedToolErrors.add(error as object);
						}

						// Re-throw so AI SDK can handle it
						throw error;
					}
				};

				const queued = stepState.chain
					.catch(() => undefined)
					.then(() => executeWithGuards());
				stepState.chain = queued.then(
					() => undefined,
					() => undefined,
				);
				return queued;
			},
		} as Tool;
	}
	return out;
}
