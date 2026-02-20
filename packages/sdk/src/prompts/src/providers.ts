import { debugLog } from './debug.ts';
import {
	getModelFamily,
	getModelInfo,
	isProviderId,
} from '../../providers/src/utils.ts';
import type { UnderlyingProviderKey } from '../../providers/src/utils.ts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_OPENAI from './providers/openai.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_ANTHROPIC from './providers/anthropic.txt' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_GOOGLE from './providers/google.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_MOONSHOT from './providers/moonshot.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_DEFAULT from './providers/default.txt' with { type: 'text' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PROVIDER_GLM from './providers/glm.txt' with { type: 'text' };

const FAMILY_PROMPTS: Record<string, string> = {
	openai: PROVIDER_OPENAI,
	anthropic: PROVIDER_ANTHROPIC,
	google: PROVIDER_GOOGLE,
	moonshot: PROVIDER_MOONSHOT,
	glm: PROVIDER_GLM,
	minimax: PROVIDER_DEFAULT,
};

function sanitizeModelId(modelId: string): string {
	return modelId
		.toLowerCase()
		.replace(/[^a-z0-9._/+-]/g, '-')
		.replace(/[/]+/g, '__');
}

function promptForFamily(family: UnderlyingProviderKey): string {
	if (!family) return PROVIDER_DEFAULT.trim();
	return (FAMILY_PROMPTS[family] ?? PROVIDER_DEFAULT).trim();
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

	if (modelId) {
		const sanitized = sanitizeModelId(modelId);
		const modelPath = `src/prompts/models/${sanitized}.txt`;
		const modelText = await readIfExists(modelPath);
		if (modelText) {
			const promptType = `model:${sanitized}`;
			debugLog(`[provider] prompt: ${promptType} (${modelText.length} chars)`);
			return { prompt: modelText, resolvedType: promptType };
		}
	}

	if (isProviderId(id) && modelId) {
		const info = getModelInfo(id, modelId);
		if (info?.ownedBy) {
			const family = getModelFamily(id, modelId);
			const result = promptForFamily(family);
			debugLog(
				`[provider] prompt: ownedBy:${info.ownedBy} (via ${id}/${modelId}, ${result.length} chars)`,
			);
			return { prompt: result, resolvedType: family ?? info.ownedBy };
		}

		const family = getModelFamily(id, modelId);
		if (family) {
			const result = promptForFamily(family);
			debugLog(
				`[provider] prompt: family:${family} (via ${id}/${modelId}, ${result.length} chars)`,
			);
			return { prompt: result, resolvedType: family };
		}
	}

	if (id === 'openai') {
		const result = PROVIDER_OPENAI.trim();
		debugLog(`[provider] prompt: openai (${result.length} chars)`);
		return { prompt: result, resolvedType: 'openai' };
	}
	if (id === 'anthropic') {
		const result = PROVIDER_ANTHROPIC.trim();
		debugLog(`[provider] prompt: anthropic (${result.length} chars)`);
		return { prompt: result, resolvedType: 'anthropic' };
	}
	if (id === 'google') {
		const result = PROVIDER_GOOGLE.trim();
		debugLog(`[provider] prompt: google (${result.length} chars)`);
		return { prompt: result, resolvedType: 'google' };
	}
	if (id === 'moonshot') {
		const result = PROVIDER_MOONSHOT.trim();
		debugLog(`[provider] prompt: moonshot (${result.length} chars)`);
		return { prompt: result, resolvedType: 'moonshot' };
	}
	if (id === 'zai' || id === 'zai-coding') {
		const result = PROVIDER_GLM.trim();
		debugLog(`[provider] prompt: glm (${result.length} chars)`);
		return { prompt: result, resolvedType: 'glm' };
	}

	const providerPath = `src/prompts/providers/${id}.txt`;
	const providerText = await readIfExists(providerPath);
	if (providerText) {
		debugLog(`[provider] prompt: custom:${id} (${providerText.length} chars)`);
		return { prompt: providerText, resolvedType: `custom:${id}` };
	}

	const result = PROVIDER_DEFAULT.trim();
	debugLog(`[provider] prompt: default (${result.length} chars)`);
	return { prompt: result, resolvedType: 'default' };
}
