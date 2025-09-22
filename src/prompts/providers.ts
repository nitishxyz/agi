// Provider-specific base prompts loader.
// Loads src/prompts/providers/<provider>.txt and returns its contents (trimmed).

import { debugLog } from '@/runtime/debug.ts';

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

	// 2) Provider-family fallback for openrouter and similar routers
	if ((id === 'openrouter' || id === 'opencode') && modelId) {
		const family = inferFamilyFromModel(modelId);
		if (family) {
			const familyPath = `src/prompts/providers/${family}.txt`;
			const familyText = await readIfExists(familyPath);
			if (familyText) {
				debugLog(
					`[provider] base prompt source: file:${familyPath} (family from model: ${modelId})`,
				);
				debugLog(`[provider] base prompt for family ${family}:\n${familyText}`);
				return familyText;
			}
		}
	}

	// 3) Provider-specific prompt: src/prompts/providers/<provider>.txt
	const providerPath = `src/prompts/providers/${id}.txt`;
	const providerText = await readIfExists(providerPath);
	if (providerText) {
		debugLog(`[provider] base prompt source: file:${providerPath}`);
		debugLog(`[provider] base prompt for ${id}:\n${providerText}`);
		return providerText;
	}

	// 4) Generic default
	const defaultPath = 'src/prompts/providers/default.txt';
	const defaultText = await readIfExists(defaultPath);
	if (defaultText) {
		debugLog(`[provider] base prompt source: file:${defaultPath}`);
		debugLog(`[provider] base prompt (default):\n${defaultText}`);
		return defaultText;
	}

	debugLog(`[provider] base prompt source: (none found) for ${id}`);
	return '';
}
