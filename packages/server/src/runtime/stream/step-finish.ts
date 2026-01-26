import type { getDb } from '@agi-cli/database';
import { messageParts } from '@agi-cli/database/schema';
import { eq } from 'drizzle-orm';
import { publish } from '../../events/bus.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';
import type { UsageData, ProviderMetadata } from '../session/db-operations.ts';
import type { StepFinishEvent } from './types.ts';

export function createStepFinishHandler(
	opts: RunOpts,
	db: Awaited<ReturnType<typeof getDb>>,
	getStepIndex: () => number,
	incrementStepIndex: () => number,
	getCurrentPartId: () => string | null,
	updateCurrentPartId: (id: string | null) => void,
	updateAccumulated: (text: string) => void,
	sharedCtx: ToolAdapterContext,
	updateSessionTokensIncrementalFn: (
		usage: UsageData,
		providerOptions: ProviderMetadata | undefined,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
	updateMessageTokensIncrementalFn: (
		usage: UsageData,
		providerOptions: ProviderMetadata | undefined,
		opts: RunOpts,
		db: Awaited<ReturnType<typeof getDb>>,
	) => Promise<void>,
) {
	return async (step: StepFinishEvent) => {
		const finishedAt = Date.now();
		const currentPartId = getCurrentPartId();
		const stepIndex = getStepIndex();

		try {
			if (currentPartId) {
				await db
					.update(messageParts)
					.set({ completedAt: finishedAt })
					.where(eq(messageParts.id, currentPartId));
			}
		} catch {}

		if (step.usage) {
			try {
				await updateSessionTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
			} catch {}

			try {
				await updateMessageTokensIncrementalFn(
					step.usage,
					step.experimental_providerMetadata,
					opts,
					db,
				);
			} catch {}
		}

		try {
			publish({
				type: 'finish-step',
				sessionId: opts.sessionId,
				payload: {
					stepIndex,
					usage: step.usage,
					finishReason: step.finishReason,
					response: step.response,
				},
			});
			if (step.usage) {
				publish({
					type: 'usage',
					sessionId: opts.sessionId,
					payload: { stepIndex, ...step.usage },
				});
			}
		} catch {}

		try {
			const newStepIndex = incrementStepIndex();
			sharedCtx.stepIndex = newStepIndex;
			updateCurrentPartId(null);
			updateAccumulated('');
		} catch {}
	};
}
