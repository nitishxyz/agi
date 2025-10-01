import { describe, expect, test } from 'bun:test';
import type { AskOptions } from '@agi-cli/cli/src/ask.ts';
import { computeEffectiveContext } from '@agi-cli/cli/src/context.ts';
import type { ProviderId } from '@agi-cli/sdk';

describe('computeEffectiveContext', () => {
	test('prefers CLI opts over session header and defaults', () => {
		const ops: AskOptions = {
			agent: 'build',
			provider: 'google',
			model: 'gemini-pro',
		};
		const chosenProvider: ProviderId = 'openai';
		const eff = computeEffectiveContext({
			ops,
			header: { agent: 'git', provider: 'anthropic', model: 'claude-3-5' },
			chosenProvider,
			chosenModel: 'gpt-4o',
			defaultAgent: 'default-agent',
		});
		expect(eff.agent).toBe('build');
		expect(eff.provider).toBe('google');
		expect(eff.model).toBe('gemini-pro');
	});

	test('falls back to session header when opts not provided', () => {
		const ops: AskOptions = {};
		const chosenProvider: ProviderId = 'openai';
		const eff = computeEffectiveContext({
			ops,
			header: { agent: 'git', provider: 'anthropic', model: 'claude-3-5' },
			chosenProvider,
			chosenModel: 'gpt-4o',
			defaultAgent: 'default-agent',
		});
		expect(eff.agent).toBe('git');
		expect(eff.provider).toBe('anthropic');
		expect(eff.model).toBe('claude-3-5');
	});

	test('falls back to chosen/config defaults when neither provided', () => {
		const ops: AskOptions = {};
		const chosenProvider: ProviderId = 'openai';
		const eff = computeEffectiveContext({
			ops,
			header: {},
			chosenProvider,
			chosenModel: 'gpt-4o',
			defaultAgent: 'default-agent',
		});
		expect(eff.agent).toBe('default-agent');
		expect(eff.provider).toBe('openai');
		expect(eff.model).toBe('gpt-4o');
	});
});
