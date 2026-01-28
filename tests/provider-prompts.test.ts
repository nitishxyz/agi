import { describe, it, expect } from 'bun:test';
import { providerBasePrompt } from '@agi-cli/sdk';

describe('provider base prompts', () => {
	it('falls back to default when provider file missing', async () => {
		const result = await providerBasePrompt(
			'unknown-provider',
			undefined,
			process.cwd(),
		);
		expect(result.prompt.length).toBeGreaterThan(0);
		expect(result.resolvedType).toBe('default');
	});

	it('uses provider family for openrouter models (gpt)', async () => {
		const result = await providerBasePrompt(
			'openrouter',
			'gpt-4o-mini',
			process.cwd(),
		);
		expect(typeof result.prompt).toBe('string');
	});

	it('uses provider family for setu models', async () => {
		const result = await providerBasePrompt('setu', 'gpt-4o-mini', process.cwd());
		expect(result.resolvedType).toBe('openai');
		expect(result.prompt.length).toBeGreaterThan(0);
	});
});
