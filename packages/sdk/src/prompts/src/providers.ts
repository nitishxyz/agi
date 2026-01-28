// Provider-specific base prompts loader.
// Loads src/prompts/providers/<provider>.txt and returns its contents (trimmed).

import { debugLog } from './debug.ts';
import { getModelNpmBinding, isProviderId } from '../../providers/src/utils.ts';
import type { ProviderId } from '../../types/src/index.ts';
// Embed default provider prompts into the binary via text imports
// Only user-defined overrides should be read from disk.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_OPENAI from './providers/openai.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_ANTHROPIC from './providers/anthropic.txt' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_GOOGLE from './providers/google.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_DEFAULT from './providers/default.txt' with { type: 'text' };

function sanitizeModelId(modelId: string): string {
	return modelId
		.toLowerCase()
		.replace(/[^a-z0-9._/+-]/g, '-')
		.replace(/[/]+/g, '__');
}

function inferFamilyFromModel(
	provider: ProviderId,
	modelId: string,
): string | undefined {
	const npm = getModelNpmBinding(provider, modelId);
	if (npm === '@ai-sdk/anthropic') return 'anthropic';
	if (npm === '@ai-sdk/openai') return 'openai';
	if (npm === '@ai-sdk/google') return 'google';
	return undefined;
}

async function readIfExists(path: string): Promise<string | undefined> {
	try {
		const f = Bun.file(path);
		if (await f.exists()) return (await f.text()).trim();
	} catch {}
	return undefined;
}

export type ProviderPromptResult = {
	prompt: string;
	resolvedType: string;
};

export async function providerBasePrompt(
	provider: string,
	modelId: string | undefined,
	_projectRoot: string,
): Promise<ProviderPromptResult> {
	const id = String(provider || '').toLowerCase();
	let promptType: string;
	let result: string;

	// 1) Model-specific override: src/prompts/models/<sanitizedModel>.txt
	if (modelId) {
		const sanitized = sanitizeModelId(modelId);
		const modelPath = `src/prompts/models/${sanitized}.txt`;
		const modelText = await readIfExists(modelPath);
		if (modelText) {
			promptType = `model:${sanitized}`;
			debugLog(`[provider] prompt: ${promptType} (${modelText.length} chars)`);
			return { prompt: modelText, resolvedType: promptType };
		}
	}

	// 2) Provider-family fallback for openrouter/opencode/setu using embedded defaults
	if (
		isProviderId(id) &&
		(id === 'openrouter' ||
			id === 'opencode' ||
			id === 'setu' ||
			id === 'zai' ||
			id === 'zai-coding') &&
		modelId
	) {
		const family = inferFamilyFromModel(id, modelId);
		if (family) {
			result = (
				family === 'openai'
					? PROVIDER_OPENAI
					: family === 'anthropic'
						? PROVIDER_ANTHROPIC
						: family === 'google'
							? PROVIDER_GOOGLE
					: PROVIDER_DEFAULT
			).trim();
			promptType = `family:${family} (via ${id}/${modelId})`;
			debugLog(`[provider] prompt: ${promptType} (${result.length} chars)`);
			return { prompt: result, resolvedType: family };
		}
	}

	// 3) Provider-specific embedded defaults for known providers
	if (id === 'openai') {
		result = PROVIDER_OPENAI.trim();
		debugLog(`[provider] prompt: openai (${result.length} chars)`);
		return { prompt: result, resolvedType: 'openai' };
	}
	if (id === 'anthropic') {
		result = PROVIDER_ANTHROPIC.trim();
		debugLog(`[provider] prompt: anthropic (${result.length} chars)`);
		return { prompt: result, resolvedType: 'anthropic' };
	}
	if (id === 'google') {
		result = PROVIDER_GOOGLE.trim();
		debugLog(`[provider] prompt: google (${result.length} chars)`);
		return { prompt: result, resolvedType: 'google' };
	}

	// If a project adds a custom provider file, allow reading it from disk (user-defined)
	const providerPath = `src/prompts/providers/${id}.txt`;
	const providerText = await readIfExists(providerPath);
	if (providerText) {
		debugLog(`[provider] prompt: custom:${id} (${providerText.length} chars)`);
		return { prompt: providerText, resolvedType: `custom:${id}` };
	}

	// 4) Generic default
	result = PROVIDER_DEFAULT.trim();
	debugLog(`[provider] prompt: default (${result.length} chars)`);
	return { prompt: result, resolvedType: 'default' };
}
