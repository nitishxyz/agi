import type { OttoConfig } from '@ottocode/sdk';
import { getAuth, createOpenAIOAuthModel } from '@ottocode/sdk';
import { openai, createOpenAI } from '@ai-sdk/openai';

export async function resolveOpenAIModel(model: string, cfg: OttoConfig) {
	const auth = await getAuth('openai', cfg.projectRoot);
	if (auth?.type === 'oauth') {
		return createOpenAIOAuthModel(model, {
			oauth: auth,
			projectRoot: cfg.projectRoot,
		});
	}
	if (auth?.type === 'api' && auth.key) {
		const instance = createOpenAI({ apiKey: auth.key });
		return instance(model);
	}
	return openai(model);
}
