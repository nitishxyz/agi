import type { getDb } from '@ottocode/database';
import { time } from '../debug/index.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';
import type { RunOpts } from '../session/queue.ts';

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

	// Simple counter starting at 0 - first event gets 0, second gets 1, etc.
	let currentIndex = 0;
	const nextIndex = () => currentIndex++;

	const sharedCtx: RunnerToolContext = {
		nextIndex,
		stepIndex: 0,
		sessionId: opts.sessionId,
		messageId: opts.assistantMessageId,
		assistantPartId: '', // Will be set by runner when first text part is created
		db,
		agent: opts.agent,
		provider: opts.provider,
		model: opts.model,
		projectRoot: opts.projectRoot,
		stepExecution: { states: new Map() },
		toolApprovalMode: opts.toolApprovalMode,
		onFirstToolCall: () => {
			if (firstToolSeen) return;
			firstToolSeen = true;
			firstToolTimer.end();
		},
	};

	return { sharedCtx, firstToolTimer, firstToolSeen: () => firstToolSeen };
}
