import { describe, it, expect } from 'bun:test';
import { catalog, providerIds } from '@agi-cli/sdk';

describe('solforge catalog entry', () => {
	it('adds solforge to providerIds', () => {
		expect(providerIds).toContain('solforge');
	});

	it('mirrors OpenAI/Anthropic models with gpt-4o-mini default', () => {
		const entry = catalog.solforge;
		expect(entry).toBeDefined();
		expect(entry?.models.length).toBeGreaterThan(0);
		expect(entry?.models[0]?.id).toBe('gpt-4o-mini');
		const providers = new Set(
			entry?.models
				.map((model) => model.provider?.npm)
				.filter((val): val is string => Boolean(val)),
		);
		expect(providers).toEqual(new Set(['@ai-sdk/openai', '@ai-sdk/anthropic']));
	});
});
