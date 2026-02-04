import { convertToModelMessages, type ModelMessage, type UIMessage } from 'ai';
import type { getDb } from '@ottocode/database';
import { messages, messageParts } from '@ottocode/database/schema';
import { eq, asc } from 'drizzle-orm';
import { debugLog } from '../debug/index.ts';
import { ToolHistoryTracker } from './tool-history-tracker.ts';

/**
 * Builds the conversation history for a session from the database,
 * converting it to the format expected by the AI SDK.
 */
export async function buildHistoryMessages(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
): Promise<ModelMessage[]> {
	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt));

	const ui: UIMessage[] = [];
	const toolHistory = new ToolHistoryTracker();

	for (const m of rows) {
		if (m.role === 'assistant' && m.status !== 'complete') {
			debugLog(
				`[buildHistoryMessages] Skipping assistant message ${m.id} with status ${m.status} (current turn still in progress)`,
			);
			logPendingToolParts(db, m.id);
			continue;
		}

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, m.id))
			.orderBy(asc(messageParts.index));

		if (m.role === 'user') {
			const uparts: UIMessage['parts'] = [];
			for (const p of parts) {
				if (p.type === 'text') {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						const t = String(obj.text ?? '');
						if (t) uparts.push({ type: 'text', text: t });
					} catch {}
				} else if (p.type === 'image') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							data?: string;
							mediaType?: string;
						};
						if (obj.data && obj.mediaType) {
							uparts.push({
								type: 'file',
								mediaType: obj.mediaType,
								url: `data:${obj.mediaType};base64,${obj.data}`,
							} as never);
						}
					} catch {}
				} else if (p.type === 'file') {
					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							type?: 'image' | 'pdf' | 'text';
							name?: string;
							data?: string;
							mediaType?: string;
							textContent?: string;
						};
						if (obj.type === 'text' && obj.textContent) {
							uparts.push({
								type: 'text',
								text: `<file name="${obj.name || 'file'}">\n${obj.textContent}\n</file>`,
							});
						} else if (obj.type === 'pdf' && obj.data && obj.mediaType) {
							uparts.push({
								type: 'file',
								mediaType: obj.mediaType,
								url: `data:${obj.mediaType};base64,${obj.data}`,
							} as never);
						} else if (obj.type === 'image' && obj.data && obj.mediaType) {
							uparts.push({
								type: 'file',
								mediaType: obj.mediaType,
								url: `data:${obj.mediaType};base64,${obj.data}`,
							} as never);
						}
					} catch {}
				}
			}
			if (uparts.length) {
				ui.push({ id: m.id, role: 'user', parts: uparts });
			}
			continue;
		}

		if (m.role === 'assistant') {
			const assistantParts: UIMessage['parts'] = [];
			const toolCalls: Array<{ name: string; callId: string; args: unknown }> =
				[];
			const toolResults: Array<{
				name: string;
				callId: string;
				result: unknown;
			}> = [];

			for (const p of parts) {
				if (p.type === 'reasoning') continue;

				if (p.type === 'text') {
					try {
						const obj = JSON.parse(p.content ?? '{}');
						const t = String(obj.text ?? '');
						if (t) assistantParts.push({ type: 'text', text: t });
					} catch {}
				} else if (p.type === 'tool_call') {
					// Skip compacted tool calls entirely
					if (p.compactedAt) continue;

					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							callId?: string;
							args?: unknown;
						};
						if (obj.callId && obj.name) {
							toolCalls.push({
								name: obj.name,
								callId: obj.callId,
								args: obj.args,
							});
						}
					} catch {}
				} else if (p.type === 'tool_result') {
					// Skip compacted tool results entirely
					if (p.compactedAt) continue;

					try {
						const obj = JSON.parse(p.content ?? '{}') as {
							name?: string;
							callId?: string;
							result?: unknown;
						};
						if (obj.callId) {
							toolResults.push({
								name: obj.name ?? 'tool',
								callId: obj.callId,
								result: obj.result,
							});
						}
					} catch {}
				}
				// Skip error parts in history
			}

			const toolResultsById = new Map(
				toolResults.map((result) => [result.callId, result]),
			);

			for (const call of toolCalls) {
				// Skip finish tool from history - it's internal loop control
				if (call.name === 'finish') continue;

				const toolType = `tool-${call.name}` as `tool-${string}`;
				let result = toolResultsById.get(call.callId);

				if (!result) {
					// Synthesize a result for incomplete tool calls to preserve history
					debugLog(
						`[buildHistoryMessages] Synthesizing error result for incomplete tool call ${call.name}#${call.callId}`,
					);
					result = {
						name: call.name,
						callId: call.callId,
						result:
							'Error: The tool execution was interrupted or failed to return a result. You may need to retry this operation.',
					};
				}

				const part = {
					type: toolType,
					state: 'output-available',
					toolCallId: call.callId,
					input: call.args,
					output: (() => {
						const r = result.result;
						if (typeof r === 'string') return r;
						try {
							return JSON.stringify(r);
						} catch {
							return String(r);
						}
					})(),
				};

				toolHistory.register(part, {
					toolName: call.name,
					callId: call.callId,
					args: call.args,
					result: result.result,
				});

				assistantParts.push(part as never);
			}

			if (assistantParts.length) {
				ui.push({ id: m.id, role: 'assistant', parts: assistantParts });
			}
		}
	}

	return await convertToModelMessages(ui);
}

async function logPendingToolParts(
	db: Awaited<ReturnType<typeof getDb>>,
	messageId: string,
) {
	try {
		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, messageId))
			.orderBy(asc(messageParts.index));

		const pendingCalls: string[] = [];
		for (const part of parts) {
			if (part.type !== 'tool_call') continue;
			try {
				const obj = JSON.parse(part.content ?? '{}') as {
					name?: string;
					callId?: string;
				};
				if (obj.name && obj.callId) {
					const resultExists = parts.some((candidate) => {
						if (candidate.type !== 'tool_result') return false;
						try {
							const parsed = JSON.parse(candidate.content ?? '{}') as {
								callId?: string;
							};
							return parsed.callId === obj.callId;
						} catch {
							return false;
						}
					});
					if (!resultExists) {
						pendingCalls.push(`${obj.name}#${obj.callId}`);
					}
				}
			} catch {}
		}
		if (pendingCalls.length) {
			debugLog(
				`[buildHistoryMessages] Pending tool calls for assistant message ${messageId}: ${pendingCalls.join(', ')}`,
			);
		}
	} catch (err) {
		debugLog(
			`[buildHistoryMessages] Failed to inspect pending tool calls for ${messageId}: ${
				err instanceof Error ? err.message : String(err)
			}`,
		);
	}
}
