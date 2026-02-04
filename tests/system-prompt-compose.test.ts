import { describe, it, expect } from 'bun:test';
import { composeSystemPrompt } from '@ottocode/server';

describe('system prompt composition', () => {
	it('injects one-shot override when enabled', async () => {
		const { prompt, components } = await composeSystemPrompt({
			provider: 'openrouter',
			model: 'gpt-4o-mini',
			projectRoot: process.cwd(),
			agentPrompt: 'AGENT',
			oneShot: true,
		});
		expect(prompt).toContain('One-shot mode ACTIVE');
		expect(components).toContain('mode:oneshot');
	});

	it('does not inject one-shot override when disabled', async () => {
		const { prompt, components } = await composeSystemPrompt({
			provider: 'openrouter',
			model: 'gpt-4o-mini',
			projectRoot: process.cwd(),
			agentPrompt: 'AGENT',
			oneShot: false,
		});
		expect(prompt).not.toContain('One-shot mode ACTIVE');
		expect(components).not.toContain('mode:oneshot');
	});
});
