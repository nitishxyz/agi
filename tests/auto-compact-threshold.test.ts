import { describe, expect, test } from 'bun:test';
import {
	resolveAutoCompactThresholdTokens,
	shouldAutoCompactAfterTurn,
	shouldAutoCompactBeforeOverflow,
	shouldStopTurnForAutoCompact,
} from '../packages/server/src/runtime/message/compaction-limits.ts';

describe('resolveAutoCompactThresholdTokens', () => {
	test('uses the custom limit when it is below the model context window', () => {
		expect(
			resolveAutoCompactThresholdTokens({
				configuredThresholdTokens: 200_000,
				modelContextWindow: 1_000_000,
			}),
		).toBe(200_000);
	});

	test('leaves the model context window in control when it is smaller', () => {
		expect(
			resolveAutoCompactThresholdTokens({
				configuredThresholdTokens: 200_000,
				modelContextWindow: 128_000,
			}),
		).toBeNull();

		expect(
			resolveAutoCompactThresholdTokens({
				configuredThresholdTokens: 200_000,
				modelContextWindow: 200_000,
			}),
		).toBeNull();
	});

	test('uses the custom limit when the model context window is unknown', () => {
		expect(
			resolveAutoCompactThresholdTokens({
				configuredThresholdTokens: 200_000,
			}),
		).toBe(200_000);
	});
});

describe('shouldAutoCompactBeforeOverflow', () => {
	test('triggers when configured threshold is reached', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 190_000,
				estimatedInputTokens: 15_000,
			}),
		).toBe(true);
	});

	test('treats the configured threshold as an explicit context cap', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 190_000,
				estimatedInputTokens: 15_000,
			}),
		).toBe(true);

		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 210_000,
			}),
		).toBe(true);
	});

	test('does not trigger for manual compact commands or compaction retries', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 210_000,
				isCompactCommand: true,
			}),
		).toBe(false);

		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 210_000,
				compactionRetries: 1,
			}),
		).toBe(false);
	});
});

describe('shouldStopTurnForAutoCompact', () => {
	test('stops the turn when the last step crosses the threshold', () => {
		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				lastStepUsage: { inputTokens: 198_000, outputTokens: 3_000 },
			}),
		).toBe(true);
	});

	test('keeps streaming while under the threshold', () => {
		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				lastStepUsage: { inputTokens: 150_000, outputTokens: 2_000 },
			}),
		).toBe(false);
	});

	test('ignores steps without usable usage', () => {
		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				lastStepUsage: null,
			}),
		).toBe(false);

		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				lastStepUsage: { inputTokens: 0, outputTokens: 500_000 },
			}),
		).toBe(false);
	});

	test('does not stop for manual compacts, retries, or missing threshold', () => {
		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				isCompactCommand: true,
				lastStepUsage: { inputTokens: 210_000 },
			}),
		).toBe(false);

		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				compactionRetries: 1,
				lastStepUsage: { inputTokens: 210_000 },
			}),
		).toBe(false);

		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: null,
				lastStepUsage: { inputTokens: 210_000 },
			}),
		).toBe(false);
	});
});

describe('shouldAutoCompactAfterTurn', () => {
	test('counts final reply output even when the tool-loop stop was not called', () => {
		for (const outputTokens of [2_000, 3_000]) {
			expect(
				shouldAutoCompactAfterTurn({
					autoCompactThresholdTokens: 200_000,
					currentContextTokens: 198_000,
					turnStoppedForCompaction: false,
					lastStepUsage: { inputTokens: 198_000, outputTokens },
				}),
			).toBe(true);
		}
	});

	test('uses the last step context rather than stale session or cumulative usage', () => {
		expect(
			shouldAutoCompactAfterTurn({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 250_000,
				lastStepUsage: { inputTokens: 100_000, outputTokens: 1_000 },
			}),
		).toBe(false);
	});

	test('falls back to session context when final input usage is unavailable', () => {
		for (const inputTokens of [undefined, null, 0, Number.NaN, Infinity]) {
			expect(
				shouldAutoCompactAfterTurn({
					autoCompactThresholdTokens: 200_000,
					currentContextTokens: 200_000,
					lastStepUsage: { inputTokens, outputTokens: 1_000 },
				}),
			).toBe(true);
		}
	});

	test('ignores invalid output counts without losing valid input usage', () => {
		for (const outputTokens of [Number.NaN, Infinity, -1]) {
			expect(
				shouldAutoCompactAfterTurn({
					autoCompactThresholdTokens: 200_000,
					lastStepUsage: { inputTokens: 200_000, outputTokens },
				}),
			).toBe(true);
			expect(
				shouldStopTurnForAutoCompact({
					autoCompactThresholdTokens: 200_000,
					lastStepUsage: { inputTokens: 100_000, outputTokens },
				}),
			).toBe(false);
		}
	});

	test('preserves manual, retry, and disabled threshold guards with final usage', () => {
		for (const guard of [
			{ isCompactCommand: true },
			{ compactionRetries: 1 },
			{ autoCompactThresholdTokens: null },
			{ autoCompactThresholdTokens: 0 },
		]) {
			expect(
				shouldAutoCompactAfterTurn({
					autoCompactThresholdTokens: 200_000,
					lastStepUsage: { inputTokens: 198_000, outputTokens: 3_000 },
					...guard,
				}),
			).toBe(false);
		}
	});

	test('compacts when output tokens triggered the mid-turn stop', () => {
		const lastStepUsage = { inputTokens: 198_000, outputTokens: 3_000 };
		expect(
			shouldStopTurnForAutoCompact({
				autoCompactThresholdTokens: 200_000,
				lastStepUsage,
			}),
		).toBe(true);

		expect(
			shouldAutoCompactAfterTurn({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: lastStepUsage.inputTokens,
				turnStoppedForCompaction: true,
			}),
		).toBe(true);
	});

	test('does not compact an under-limit turn without a stop trigger', () => {
		expect(
			shouldAutoCompactAfterTurn({
				autoCompactThresholdTokens: 200_000,
				currentContextTokens: 198_000,
				turnStoppedForCompaction: false,
			}),
		).toBe(false);
	});
});
