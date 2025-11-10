// Provider-specific base prompts loader.
// Loads src/prompts/providers/<provider>.txt and returns its contents (trimmed).

import { debugLog } from './debug.ts';
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

function inferFamilyFromModel(modelId: string): string | undefined {
	const m = modelId.toLowerCase();
	if (m.includes('claude')) return 'anthropic';
	if (m.includes('gemini')) return 'google';
	if (m.includes('gpt') || m.startsWith('o') || m.includes('openai'))
		return 'openai';
	// Other common families you may add prompts for later:
	// if (m.includes('llama')) return 'meta';
	// if (m.includes('mistral')) return 'mistral';
	// if (m.includes('deepseek')) return 'deepseek';
	// if (m.includes('qwen')) return 'qwen';
	// if (m.includes('moonshot') || m.includes('kimi')) return 'moonshot';
	return undefined;
}

async function readIfExists(path: string): Promise<string | undefined> {
	try {
		const f = Bun.file(path);
		if (await f.exists()) return (await f.text()).trim();
	} catch {}
	return undefined;
}

export async function providerBasePrompt(
	provider: string,
	modelId: string | undefined,
	_projectRoot: string,
): Promise<string> {
	const id = String(provider || '').toLowerCase();

	// 1) Model-specific override: src/prompts/models/<sanitizedModel>.txt
	if (modelId) {
		const sanitized = sanitizeModelId(modelId);
		const modelPath = `src/prompts/models/${sanitized}.txt`;
		const modelText = await readIfExists(modelPath);
		if (modelText) {
			debugLog(`[provider] base prompt source: file:${modelPath}`);
			debugLog(`[provider] base prompt for model ${modelId}:\n${modelText}`);
			return modelText;
		}
	}

	// 2) Provider-family fallback for openrouter/opencode/solforge using embedded defaults
	if (
		(id === 'openrouter' || id === 'opencode' || id === 'solforge') &&
		modelId
	) {
		const family = inferFamilyFromModel(modelId);
		if (family) {
			const embedded = (
				family === 'openai'
					? PROVIDER_OPENAI
					: family === 'anthropic'
						? PROVIDER_ANTHROPIC
						: family === 'google'
							? PROVIDER_GOOGLE
							: PROVIDER_DEFAULT
			).trim();
			debugLog(
				`[provider] base prompt source: embedded:${family}.txt (family from model: ${modelId})`,
			);
			debugLog(`[provider] base prompt for family ${family}:\n${embedded}`);
			return embedded;
		}
	}

	// 3) Provider-specific embedded defaults for known providers
	if (id === 'openai') {
		const txt = PROVIDER_OPENAI.trim();
		debugLog('[provider] base prompt source: embedded:providers/openai.txt');
		return txt;
	}
	if (id === 'anthropic') {
		const txt = PROVIDER_ANTHROPIC.trim();
		debugLog('[provider] base prompt source: embedded:providers/anthropic.txt');
		return txt;
	}
	if (id === 'google') {
		const txt = PROVIDER_GOOGLE.trim();
		debugLog('[provider] base prompt source: embedded:providers/google.txt');
		return txt;
	}
	// If a project adds a custom provider file, allow reading it from disk (user-defined)
	const providerPath = `src/prompts/providers/${id}.txt`;
	const providerText = await readIfExists(providerPath);
	if (providerText) {
		debugLog(`[provider] base prompt source: file:${providerPath}`);
		debugLog(`[provider] base prompt for ${id}:\n${providerText}`);
		return providerText;
	}

	// 4) Generic default
	debugLog('[provider] base prompt source: embedded:providers/default.txt');
	return PROVIDER_DEFAULT.trim();
}
