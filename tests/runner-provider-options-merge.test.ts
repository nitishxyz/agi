import { describe, expect, test } from 'bun:test';
import { mergeProviderOptions } from '../packages/server/src/runtime/agent/runner-setup.ts';

describe('mergeProviderOptions', () => {
	test('preserves existing nested OpenAI OAuth instructions', () => {
		const base = {
			openai: {
				store: false,
				instructions: 'You are a coding agent.',
				parallelToolCalls: false,
			},
		};

		const incoming = {
			openai: {
				reasoningEffort: 'high',
				reasoningSummary: 'auto',
			},
		};

		const result = mergeProviderOptions(base, incoming);

		expect(result).toEqual({
			openai: {
				store: false,
				instructions: 'You are a coding agent.',
				parallelToolCalls: false,
				reasoningEffort: 'high',
				reasoningSummary: 'auto',
			},
		});
	});
});
