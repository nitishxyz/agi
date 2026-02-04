import type { getDb } from '@ottocode/database';
import { messageParts } from '@ottocode/database/schema';
import { eq } from 'drizzle-orm';
import { publish } from '../../events/bus.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';

export type ReasoningState = {
	partId: string;
	text: string;
	providerMetadata?: unknown;
};

export function serializeReasoningContent(state: ReasoningState): string {
	return JSON.stringify(
		state.providerMetadata != null
			? { text: state.text, providerMetadata: state.providerMetadata }
			: { text: state.text },
	);
}

export async function handleReasoningStart(
	reasoningId: string,
	providerMetadata: unknown,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	sharedCtx: ToolAdapterContext,
	getStepIndex: () => number,
	reasoningStates: Map<string, ReasoningState>,
): Promise<void> {
	const reasoningPartId = crypto.randomUUID();
	const state: ReasoningState = {
		partId: reasoningPartId,
		text: '',
		providerMetadata,
	};
	reasoningStates.set(reasoningId, state);
	try {
		await db.insert(messageParts).values({
			id: reasoningPartId,
			messageId: opts.assistantMessageId,
			index: await sharedCtx.nextIndex(),
			stepIndex: getStepIndex(),
			type: 'reasoning',
			content: serializeReasoningContent(state),
			agent: opts.agent,
			provider: opts.provider,
			model: opts.model,
			startedAt: Date.now(),
		});
	} catch {}
}

export async function handleReasoningDelta(
	reasoningId: string,
	text: string,
	providerMetadata: unknown,
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	reasoningStates: Map<string, ReasoningState>,
): Promise<void> {
	const state = reasoningStates.get(reasoningId);
	if (!state) return;
	state.text += text;
	if (providerMetadata != null) {
		state.providerMetadata = providerMetadata;
	}
	publish({
		type: 'reasoning.delta',
		sessionId: opts.sessionId,
		payload: {
			messageId: opts.assistantMessageId,
			partId: state.partId,
			stepIndex: getStepIndex(),
			delta: text,
		},
	});
	try {
		await db
			.update(messageParts)
			.set({ content: serializeReasoningContent(state) })
			.where(eq(messageParts.id, state.partId));
	} catch {}
}

export async function handleReasoningEnd(
	reasoningId: string,
	db: Awaited<ReturnType<typeof getDb>>,
	reasoningStates: Map<string, ReasoningState>,
): Promise<void> {
	const state = reasoningStates.get(reasoningId);
	if (!state) return;
	if (!state.text || state.text.trim() === '') {
		try {
			await db.delete(messageParts).where(eq(messageParts.id, state.partId));
		} catch {}
		reasoningStates.delete(reasoningId);
		return;
	}
	try {
		await db
			.update(messageParts)
			.set({ completedAt: Date.now() })
			.where(eq(messageParts.id, state.partId));
	} catch {}
	reasoningStates.delete(reasoningId);
}
