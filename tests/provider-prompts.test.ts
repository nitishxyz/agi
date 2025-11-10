import { describe, it, expect } from 'bun:test';
import { providerBasePrompt } from '@agi-cli/sdk';

describe('provider base prompts', () => {
	it('falls back to default when provider file missing', async () => {
		const txt = await providerBasePrompt(
			'unknown-provider',
			undefined,
			process.cwd(),
		);
		expect(txt.length).toBeGreaterThan(0);
	});

	it('uses provider family for openrouter models (gpt)', async () => {
		const txt = await providerBasePrompt(
			'openrouter',
			'gpt-4o-mini',
			process.cwd(),
		);
		// openai.txt is present as a code file (even minimal)
		expect(typeof txt).toBe('string');
	});

	it('uses provider family for solforge models', async () => {
		const txt = await providerBasePrompt(
			'solforge',
			'gpt-4o-mini',
			process.cwd(),
		);
		expect(typeof txt).toBe('string');
		expect(txt.length).toBeGreaterThan(0);
	});
});
