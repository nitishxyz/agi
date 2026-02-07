import type { getDb } from '@ottocode/database';
import { messageParts } from '@ottocode/database/schema';
import { eq } from 'drizzle-orm';
import { publish } from '../../events/bus.ts';
import type { RunOpts } from '../session/queue.ts';
import type { ToolAdapterContext } from '../../tools/adapter.ts';
import type { UsageData, ProviderMetadata } from '../session/db-operations.ts';
import type { StepFinishEvent } from './types.ts';
import { debugLog } from '../debug/index.ts';

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
		} catch (err) {
			debugLog(
				`[step-finish] Failed to update part completedAt: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		if (step.usage) {
			try {
				await updateSessionTokensIncrementalFn(
					step.usage,
					step.providerMetadata,
					opts,
					db,
				);
			} catch (err) {
				debugLog(
					`[step-finish] Failed to update session tokens: ${err instanceof Error ? err.message : String(err)}`,
				);
			}

			try {
				await updateMessageTokensIncrementalFn(
					step.usage,
					step.providerMetadata,
					opts,
					db,
				);
			} catch (err) {
				debugLog(
					`[step-finish] Failed to update message tokens: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
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
		} catch (err) {
			debugLog(
				`[step-finish] Failed to publish finish-step: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		try {
			const newStepIndex = incrementStepIndex();
			sharedCtx.stepIndex = newStepIndex;
			updateCurrentPartId(null);
			updateAccumulated('');
		} catch (err) {
			debugLog(
				`[step-finish] Failed to increment step: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};
}
