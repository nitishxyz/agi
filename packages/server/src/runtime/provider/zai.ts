import type { AGIConfig } from '@agi-cli/sdk';
import { catalog, getAuth } from '@agi-cli/sdk';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export async function getZaiInstance(cfg: AGIConfig, model: string) {
	const auth = await getAuth('zai', cfg.projectRoot);
	const entry = catalog.zai;

	let apiKey = '';
	const baseURL = entry?.api || 'https://api.z.ai/api/paas/v4';

	if (auth?.type === 'api' && auth.key) {
		apiKey = auth.key;
	} else {
		apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || '';
	}

	const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

	const instance = createOpenAICompatible({
		name: entry?.label ?? 'Z.AI',
		baseURL,
		headers,
	});

	return instance(model);
}

export async function getZaiCodingInstance(cfg: AGIConfig, model: string) {
	const auth =
		(await getAuth('zai', cfg.projectRoot)) ||
		(await getAuth('zai-coding', cfg.projectRoot));
	const entry = catalog['zai-coding'];

	let apiKey = '';
	const baseURL = entry?.api || 'https://api.z.ai/api/coding/paas/v4';

	if (auth?.type === 'api' && auth.key) {
		apiKey = auth.key;
	} else {
		apiKey = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || '';
	}

	const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

	const instance = createOpenAICompatible({
		name: entry?.label ?? 'Z.AI Coding',
		baseURL,
		headers,
	});

	return instance(model);
}
