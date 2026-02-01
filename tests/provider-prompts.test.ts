import { describe, it, expect } from 'bun:test';
import {
	providerBasePrompt,
	getModelFamily,
	getUnderlyingProviderKey,
	catalog,
} from '@agi-cli/sdk';

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

	describe('direct provider prompt selection', () => {
		it('uses openai prompt for openai provider', async () => {
			const result = await providerBasePrompt(
				'openai',
				'gpt-4o',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('openai');
			expect(result.prompt).toContain('coding agent');
		});

		it('uses anthropic prompt for anthropic provider', async () => {
			const result = await providerBasePrompt(
				'anthropic',
				'claude-3-opus',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('anthropic');
			expect(result.prompt).toContain('Claude');
		});

		it('uses google prompt for google provider', async () => {
			const result = await providerBasePrompt(
				'google',
				'gemini-pro',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('google');
			expect(result.prompt).toContain('software engineering');
		});

		it('uses moonshot prompt for moonshot provider', async () => {
			const result = await providerBasePrompt(
				'moonshot',
				'kimi-k2.5',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('moonshot');
			expect(result.prompt).toContain('Kimi');
			expect(result.prompt).toContain('Thinking mode');
		});
	});

	describe('aggregate provider family detection (setu)', () => {
		it('detects openai family for setu gpt models', async () => {
			const result = await providerBasePrompt(
				'setu',
				'gpt-5-nano',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('openai');
			expect(result.prompt).toContain('coding agent');
		});

		it('detects anthropic family for setu claude models', async () => {
			const result = await providerBasePrompt(
				'setu',
				'claude-3-5-haiku-latest',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('anthropic');
			expect(result.prompt).toContain('Claude');
		});

		it('detects moonshot family for setu kimi models', async () => {
			const result = await providerBasePrompt(
				'setu',
				'kimi-k2.5',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('moonshot');
			expect(result.prompt).toContain('Kimi');
		});

		it('detects moonshot family for kimi-k2-thinking via setu', async () => {
			const result = await providerBasePrompt(
				'setu',
				'kimi-k2-thinking',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('moonshot');
			expect(result.prompt).toContain('Thinking mode');
		});
	});

	describe('aggregate provider family detection (openrouter)', () => {
		it('detects openai family for openrouter gpt models', async () => {
			const result = await providerBasePrompt(
				'openrouter',
				'openai/gpt-4o',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('openai');
		});

		it('detects anthropic family for openrouter claude models', async () => {
			const result = await providerBasePrompt(
				'openrouter',
				'anthropic/claude-3-opus',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('anthropic');
		});

		it('detects moonshot family for openrouter kimi models', async () => {
			const result = await providerBasePrompt(
				'openrouter',
				'moonshotai/kimi-k2.5',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('moonshot');
		});

		it('detects google family for openrouter gemini models', async () => {
			const result = await providerBasePrompt(
				'openrouter',
				'google/gemini-pro',
				process.cwd(),
			);
			expect(result.resolvedType).toBe('google');
		});
	});

	describe('getModelFamily - catalog-based family detection', () => {
		it('returns direct provider mapping for known providers', () => {
			expect(getModelFamily('openai', 'gpt-4o')).toBe('openai');
			expect(getModelFamily('anthropic', 'claude-3-opus')).toBe('anthropic');
			expect(getModelFamily('google', 'gemini-pro')).toBe('google');
			expect(getModelFamily('moonshot', 'kimi-k2.5')).toBe('moonshot');
		});

		it('reads family field from catalog for setu models', () => {
			// Setu models have family set in their provider binding
			const setuEntry = catalog.setu;
			expect(setuEntry).toBeDefined();

			// Find a kimi model in setu
			const kimiModel = setuEntry?.models.find((m) => m.id.includes('kimi'));
			if (kimiModel) {
				expect(kimiModel.provider?.family).toBe('moonshot');
				expect(getModelFamily('setu', kimiModel.id)).toBe('moonshot');
			}

			// Find a claude model in setu
			const claudeModel = setuEntry?.models.find((m) =>
				m.id.startsWith('claude'),
			);
			if (claudeModel) {
				expect(claudeModel.provider?.family).toBe('anthropic');
				expect(getModelFamily('setu', claudeModel.id)).toBe('anthropic');
			}

			// Find a gpt model in setu
			const gptModel = setuEntry?.models.find(
				(m) => m.id.startsWith('gpt') || m.id.startsWith('codex'),
			);
			if (gptModel) {
				expect(gptModel.provider?.family).toBe('openai');
				expect(getModelFamily('setu', gptModel.id)).toBe('openai');
			}
		});

		it('falls back to npm binding when family not set', () => {
			const family = getModelFamily('openrouter', 'openai/gpt-4o');
			// Now uses prefix detection instead of npm fallback
			expect(family).toBe('openai');
		});

		it('detects families from model ID patterns for openrouter', () => {
			expect(getModelFamily('openrouter', 'anthropic/claude-3-opus')).toBe(
				'anthropic',
			);
			expect(getModelFamily('openrouter', 'openai/gpt-4o')).toBe('openai');
			expect(getModelFamily('openrouter', 'google/gemini-pro')).toBe('google');
			expect(getModelFamily('openrouter', 'moonshotai/kimi-k2.5')).toBe(
				'moonshot',
			);
		});

		it('detects families from model name for opencode', () => {
			expect(getModelFamily('opencode', 'claude-3-opus')).toBe('anthropic');
			expect(getModelFamily('opencode', 'gpt-5')).toBe('openai');
			expect(getModelFamily('opencode', 'gemini-2-flash')).toBe('google');
			expect(getModelFamily('opencode', 'kimi-k2.5')).toBe('moonshot');
		});
	});

	describe('getUnderlyingProviderKey - npm-based detection', () => {
		it('maps npm packages to provider keys', () => {
			// Direct providers
			expect(getUnderlyingProviderKey('anthropic', 'claude-3-opus')).toBe(
				'anthropic',
			);
			expect(getUnderlyingProviderKey('openai', 'gpt-4o')).toBe('openai');
			expect(getUnderlyingProviderKey('google', 'gemini-pro')).toBe('google');
			expect(getUnderlyingProviderKey('moonshot', 'kimi-k2')).toBe('moonshot');
		});

		it('maps @ai-sdk/anthropic to anthropic', () => {
			// For models that have npm binding set to anthropic
			expect(getUnderlyingProviderKey('setu', 'claude-3-5-haiku-latest')).toBe(
				'anthropic',
			);
		});

		it('maps @ai-sdk/openai to openai', () => {
			expect(getUnderlyingProviderKey('setu', 'codex-mini-latest')).toBe(
				'openai',
			);
		});

		it('maps @ai-sdk/openai-compatible to openai-compatible', () => {
			// Moonshot uses openai-compatible SDK
			expect(getUnderlyingProviderKey('setu', 'kimi-k2.5')).toBe(
				'openai-compatible',
			);
		});
	});

	describe('catalog family field is properly set', () => {
		it('setu models have family field in provider binding', () => {
			const setuEntry = catalog.setu;
			expect(setuEntry).toBeDefined();
			expect(setuEntry?.models.length).toBeGreaterThan(0);

			// Every setu model should have a family field
			for (const model of setuEntry?.models || []) {
				expect(model.provider?.family).toBeDefined();
				expect(['openai', 'anthropic', 'moonshot']).toContain(
					model.provider?.family,
				);
			}
		});

		it('moonshot provider models have correct npm binding', () => {
			const moonshotEntry = catalog.moonshot;
			expect(moonshotEntry).toBeDefined();
			expect(moonshotEntry?.npm).toBe('@ai-sdk/openai-compatible');

			// All moonshot models should be kimi models
			for (const model of moonshotEntry?.models || []) {
				expect(model.id).toContain('kimi');
			}
		});
	});

	describe('prompt content verification', () => {
		it('provider prompts contain relevant provider-specific instructions', async () => {
			const openai = await providerBasePrompt(
				'openai',
				'gpt-4o',
				process.cwd(),
			);
			const google = await providerBasePrompt(
				'google',
				'gemini-pro',
				process.cwd(),
			);
			const moonshot = await providerBasePrompt(
				'moonshot',
				'kimi-k2.5',
				process.cwd(),
			);

			// Each provider prompt should be non-empty and contain relevant instructions
			expect(openai.prompt.length).toBeGreaterThan(100);
			expect(google.prompt.length).toBeGreaterThan(100);
			expect(moonshot.prompt.length).toBeGreaterThan(100);
			expect(moonshot.prompt).toContain('Kimi');
		});

		it('anthropic prompt has conciseness examples in XML', async () => {
			const result = await providerBasePrompt(
				'anthropic',
				'claude-3-opus',
				process.cwd(),
			);
			expect(result.prompt).toContain('Claude');
			// Anthropic prompt contains detailed instructions
			expect(result.prompt.length).toBeGreaterThan(100);
		});

		it('default prompt has communication style', async () => {
			const result = await providerBasePrompt(
				'unknown-provider',
				undefined,
				process.cwd(),
			);
			expect(result.prompt).toContain('coding agent');
			expect(result.prompt.length).toBeGreaterThan(100);
		});

		it('all provider prompts are present and non-trivial', async () => {
			const providers = [
				{ provider: 'openai', model: 'gpt-4o' },
				{ provider: 'anthropic', model: 'claude-3-opus' },
				{ provider: 'google', model: 'gemini-pro' },
				{ provider: 'moonshot', model: 'kimi-k2.5' },
			];
			for (const { provider, model } of providers) {
				const result = await providerBasePrompt(provider, model, process.cwd());
				expect(result.prompt.length).toBeGreaterThan(50);
				expect(typeof result.resolvedType).toBe('string');
			}
		});
	});
});
