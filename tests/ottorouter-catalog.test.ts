import { describe, it, expect } from 'bun:test';
import { catalog, providerIds } from '@ottocode/sdk';

describe('ottorouter catalog entry', () => {
	it('adds ottorouter to providerIds', () => {
		expect(providerIds).toContain('ottorouter');
	});

	it('sources models from ottorouterCatalog with gpt-5-codex default', () => {
		const entry = catalog.ottorouter;
		expect(entry).toBeDefined();
		expect(entry?.models.length).toBeGreaterThan(0);
		expect(entry?.models[0]?.id).toBe('gpt-5-codex');
		const providers = new Set(
			entry?.models
				.map((model) => model.provider?.npm)
				.filter((val): val is string => Boolean(val)),
		);
		expect(providers).toEqual(
			new Set([
				'@ai-sdk/openai',
				'@ai-sdk/anthropic',
				'@ai-sdk/google',
				'@ai-sdk/openai-compatible',
				'@openrouter/ai-sdk-provider',
			]),
		);
	});

	it('assigns the OpenRouter SDK binding to OpenRouter-backed OttoRouter models', () => {
		const entry = catalog.ottorouter;
		const model = entry?.models.find((m) => m.id === 'healer-alpha');
		expect(model?.ownedBy).toBe('openrouter');
		expect(model?.provider?.npm).toBe('@openrouter/ai-sdk-provider');
	});

	it('has cost and limit from ottorouter API', () => {
		const entry = catalog.ottorouter;
		const model = entry?.models.find((m) => m.id === 'gpt-5-codex');
		expect(model?.cost?.input).toBeGreaterThan(0);
		expect(model?.cost?.output).toBeGreaterThan(0);
		expect(model?.limit?.context).toBeGreaterThan(0);
		expect(model?.limit?.output).toBeGreaterThan(0);
	});

	it('every model has ownedBy set', () => {
		const entry = catalog.ottorouter;
		for (const model of entry?.models ?? []) {
			expect(model.ownedBy).toBeDefined();
		}
	});
});
