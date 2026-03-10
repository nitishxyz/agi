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

function getPromptOverridePaths(args: {
	projectRoot: string;
	provider: string;
	modelId?: string;
}): { modelPaths: string[]; providerPaths: string[] } {
	const { projectRoot, provider, modelId } = args;
	const modelPaths: string[] = [];
	const providerPaths: string[] = [];

	if (modelId) {
		const sanitized = sanitizeModelId(modelId);
		modelPaths.push(`${projectRoot}/.otto/prompts/models/${sanitized}.txt`);
	}

	providerPaths.push(`${projectRoot}/.otto/prompts/providers/${provider}.txt`);

	return { modelPaths, providerPaths };
}

export type ProviderPromptResult = {
	prompt: string;
	resolvedType: string;
};

export async function providerBasePrompt(
	provider: string,
	modelId: string | undefined,
	projectRoot: string,
): Promise<ProviderPromptResult> {
	const id = String(provider || '').toLowerCase();
	const { modelPaths, providerPaths } = getPromptOverridePaths({
		projectRoot,
		provider: id,
		modelId,
	});

	if (modelId) {
		const sanitized = sanitizeModelId(modelId);
		for (const modelPath of modelPaths) {
			const modelText = await readIfExists(modelPath);
			if (!modelText) continue;
			const promptType = `model:${sanitized}`;
			debugLog(
				`[provider] prompt: ${promptType} (${modelText.length} chars) from ${modelPath}`,
			);
			return { prompt: modelText, resolvedType: promptType };
		}
	}

	for (const providerPath of providerPaths) {
		const providerText = await readIfExists(providerPath);
		if (!providerText) continue;
		debugLog(
			`[provider] prompt: custom:${id} (${providerText.length} chars) from ${providerPath}`,
		);
		return { prompt: providerText, resolvedType: `custom:${id}` };
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

	const result = PROVIDER_DEFAULT.trim();
	debugLog(`[provider] prompt: default (${result.length} chars)`);
	return { prompt: result, resolvedType: 'default' };
}
