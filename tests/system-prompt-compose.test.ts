import { describe, it, expect } from 'bun:test';
import { composeSystemPrompt } from '@/server/runtime/prompt.ts';

describe('system prompt composition', () => {
	it('injects one-shot override when enabled', async () => {
		const system = await composeSystemPrompt({
			provider: 'openrouter',
			model: 'gpt-4o-mini',
			projectRoot: process.cwd(),
			agentPrompt: 'AGENT',
			oneShot: true,
		});
		expect(system).toContain('One-shot mode ACTIVE');
	});

	it('does not inject one-shot override when disabled', async () => {
		const system = await composeSystemPrompt({
			provider: 'openrouter',
			model: 'gpt-4o-mini',
			projectRoot: process.cwd(),
			agentPrompt: 'AGENT',
			oneShot: false,
		});
		expect(system).not.toContain('One-shot mode ACTIVE');
	});
});
