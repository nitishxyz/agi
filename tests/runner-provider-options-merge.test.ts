import { describe, expect, test } from 'bun:test';
import { mergeProviderOptions } from '../packages/server/src/runtime/agent/runner-setup.ts';
import { buildCodexProviderOptions } from '../packages/server/src/runtime/provider/oauth-adapter.ts';

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

	test('merges nested OpenRouter provider options without dropping existing routing config', () => {
		const base = {
			openrouter: {
				provider: {
					allow_fallbacks: true,
					require_parameters: true,
				},
			},
		};

		const incoming = {
			openrouter: {
				reasoning: {
					effort: 'medium',
				},
			},
		};

		const result = mergeProviderOptions(base, incoming);

		expect(result).toEqual({
			openrouter: {
				provider: {
					allow_fallbacks: true,
					require_parameters: true,
				},
				reasoning: {
					effort: 'medium',
				},
			},
		});
	});

	test('uses composed prompt as OpenAI OAuth instructions', () => {
		const result = buildCodexProviderOptions('Full composed prompt here');

		expect(result).toEqual({
			openai: {
				store: false,
				instructions: 'Full composed prompt here',
				parallelToolCalls: false,
			},
		});
	});
});
