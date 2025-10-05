import type { getDb } from '@agi-cli/database';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { time } from './debug.ts';
import type { ToolAdapterContext } from '../tools/adapter.ts';
import type { RunOpts } from './session-queue.ts';

export type RunnerToolContext = ToolAdapterContext & { stepIndex: number };

/**
 * Sets up the shared tool context for a run, including the index counter
 * and first tool call tracking.
 */
export async function setupToolContext(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
) {
	const firstToolTimer = time('runner:first-tool-call');
	let firstToolSeen = false;

	const sharedCtx: RunnerToolContext = {
		nextIndex: async () => 0,
		stepIndex: 0,
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		assistantPartId: opts.assistantPartId,
		db,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		projectRoot: opts.projectRoot,
		onFirstToolCall: () => {
			if (firstToolSeen) return;
			firstToolSeen = true;
			firstToolTimer.end();
		},
	};

	let counter = 0;
	try {
		const existing = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, opts.assistantMessageId));
		if (existing.length) {
			const indexes = existing.map((p) => Number(p.index ?? 0));
			const maxIndex = Math.max(...indexes);
			if (Number.isFinite(maxIndex)) counter = maxIndex;
		}
	} catch {}

	sharedCtx.nextIndex = () => {
		counter += 1;
		return counter;
	};

	return { sharedCtx, firstToolTimer, firstToolSeen: () => firstToolSeen };
}
