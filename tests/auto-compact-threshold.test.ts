import { describe, expect, test } from 'bun:test';
import { shouldAutoCompactBeforeOverflow } from '../packages/server/src/runtime/message/compaction-limits.ts';

describe('shouldAutoCompactBeforeOverflow', () => {
	test('triggers when configured threshold is reached on a larger-context model', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				modelContextWindow: 1_000_000,
				currentContextTokens: 190_000,
				estimatedInputTokens: 15_000,
			}),
		).toBe(true);
	});

	test('does not trigger when model context window is smaller than the configured threshold', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				modelContextWindow: 128_000,
				currentContextTokens: 120_000,
				estimatedInputTokens: 20_000,
			}),
		).toBe(false);
	});

	test('does not trigger for manual compact commands or compaction retries', () => {
		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				modelContextWindow: 1_000_000,
				currentContextTokens: 210_000,
				isCompactCommand: true,
			}),
		).toBe(false);

		expect(
			shouldAutoCompactBeforeOverflow({
				autoCompactThresholdTokens: 200_000,
				modelContextWindow: 1_000_000,
				currentContextTokens: 210_000,
				compactionRetries: 1,
			}),
		).toBe(false);
	});
});
