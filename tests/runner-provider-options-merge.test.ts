import { describe, expect, test } from 'bun:test';
import {
	applyModelFamilyEditToolPolicy,
	mergeProviderOptions,
} from '../packages/server/src/runtime/agent/runner-setup.ts';
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

describe('applyModelFamilyEditToolPolicy', () => {
	test('keeps only write and apply_patch for Anthropic-family build models', () => {
		const result = applyModelFamilyEditToolPolicy(
			'build',
			['read', 'edit', 'multiedit', 'write', 'apply_patch', 'bash'],
			'anthropic',
			'claude-sonnet-4-20250514',
		);

		expect(result).toEqual(['read', 'bash', 'write', 'apply_patch']);
	});

	test('keeps only write and apply_patch for OpenAI-family general models', () => {
		const result = applyModelFamilyEditToolPolicy(
			'general',
			['read', 'edit', 'multiedit', 'write', 'apply_patch', 'bash'],
			'openrouter',
			'openai/gpt-4.1',
		);

		expect(result).toEqual(['read', 'bash', 'write', 'apply_patch']);
	});

	test('keeps write, edit, and multiedit for non-Anthropic/OpenAI init models', () => {
		const result = applyModelFamilyEditToolPolicy(
			'init',
			['read', 'edit', 'multiedit', 'write', 'apply_patch', 'bash'],
			'google',
			'gemini-2.5-flash',
		);

		expect(result).toEqual(['read', 'bash', 'write', 'edit', 'multiedit']);
	});

	test('does not rewrite tool choices for agents outside the policy set', () => {
		const tools = ['read', 'edit', 'multiedit', 'write', 'apply_patch', 'bash'];
		const result = applyModelFamilyEditToolPolicy(
			'plan',
			tools,
			'google',
			'gemini-2.5-flash',
		);

		expect(result).toEqual(tools);
	});
});
