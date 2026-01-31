import { describe, it, expect } from 'bun:test';
import { catalog, providerIds } from '@agi-cli/sdk';

describe('setu catalog entry', () => {
	it('adds setu to providerIds', () => {
		expect(providerIds).toContain('setu');
	});

	it('mirrors OpenAI/Anthropic models with codex-mini-latest default', () => {
		const entry = catalog.setu;
		expect(entry).toBeDefined();
		expect(entry?.models.length).toBeGreaterThan(0);
		expect(entry?.models[0]?.id).toBe('codex-mini-latest');
		const providers = new Set(
			entry?.models
				.map((model) => model.provider?.npm)
				.filter((val): val is string => Boolean(val)),
		);
		expect(providers).toEqual(new Set(['@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/openai-compatible']));
	});
});
