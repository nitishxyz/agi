import { eq } from 'drizzle-orm';
import type { DB } from '@/db/index.ts';
import { messageParts } from '@/db/schema/index.ts';
import { publish } from '@/server/events/bus.ts';

export type ToolAdapterContext = {
	sessionId: string;
	messageId: string;
	assistantPartId: string;
	db: DB;
	agent: string;
	provider: string;
	model: string;
	projectRoot: string;
	nextIndex: () => number | Promise<number>;
	stepIndex?: number;
};

export function extractFinishText(input: unknown): string | undefined {
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

export async function appendAssistantText(
	ctx: ToolAdapterContext,
	text: string,
): Promise<void> {
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
			const payload: Record<string, unknown> = {
				messageId: ctx.messageId,
				partId: ctx.assistantPartId,
				delta: addition,
			};
			if (ctx.stepIndex !== undefined) payload.stepIndex = ctx.stepIndex;
			publish({
				type: 'message.part.delta',
				sessionId: ctx.sessionId,
				payload,
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
