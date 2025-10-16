import { convertToModelMessages, type ModelMessage, type UIMessage } from 'ai';
import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq, asc } from 'drizzle-orm';
import { debugLog } from './debug.ts';

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

	for (const m of rows) {
		if (m.role === 'assistant' && m.status !== 'complete') {
			debugLog(
				`[buildHistoryMessages] Skipping assistant message ${m.id} with status ${m.status}`,
			);
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
				if (p.type !== 'text') continue;
				try {
					const obj = JSON.parse(p.content ?? '{}');
					const t = String(obj.text ?? '');
					if (t) uparts.push({ type: 'text', text: t });
				} catch {}
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

			const hasIncompleteTools = toolCalls.some(
				(call) => !toolResults.find((result) => result.callId === call.callId),
			);

			if (hasIncompleteTools) {
				debugLog(
					`[buildHistoryMessages] Incomplete tool calls for assistant message ${m.id}, pushing text only`,
				);
				if (assistantParts.length) {
					ui.push({ id: m.id, role: 'assistant', parts: assistantParts });
				}
				continue;
			}

			for (const call of toolCalls) {
				// Skip finish tool from history - it's internal loop control
				if (call.name === 'finish') continue;

				const toolType = `tool-${call.name}` as `tool-${string}`;
				const result = toolResults.find((r) => r.callId === call.callId);

				if (result) {
					const outputStr = (() => {
						const r = result.result;
						if (typeof r === 'string') return r;
						try {
							return JSON.stringify(r);
						} catch {
							return String(r);
						}
					})();

					assistantParts.push({
						type: toolType,
						state: 'output-available',
						toolCallId: call.callId,
						input: call.args,
						output: outputStr,
					} as never);
				}
			}

			if (assistantParts.length) {
				ui.push({ id: m.id, role: 'assistant', parts: assistantParts });

				if (toolResults.length) {
					const userParts: UIMessage['parts'] = toolResults.map((r) => {
						const out =
							typeof r.result === 'string'
								? r.result
								: JSON.stringify(r.result);
						return { type: 'text', text: out };
					});
					if (userParts.length) {
						ui.push({ id: m.id, role: 'user', parts: userParts });
					}
				}
			}
		}
	}

	return convertToModelMessages(ui);
}
