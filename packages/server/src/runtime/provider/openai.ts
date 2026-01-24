import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth, createOpenAIOAuthModel } from '@agi-cli/sdk';
import { openai, createOpenAI } from '@ai-sdk/openai';

export async function resolveOpenAIModel(
	model: string,
	cfg: AGIConfig,
	options?: {
		systemPrompt?: string;
	},
) {
	const auth = await getAuth('openai', cfg.projectRoot);
	if (auth?.type === 'oauth') {
		const isCodexModel = model.toLowerCase().includes('codex');
		return createOpenAIOAuthModel(model, {
			oauth: auth,
			projectRoot: cfg.projectRoot,
			reasoningEffort: isCodexModel ? 'high' : 'medium',
			reasoningSummary: 'auto',
			instructions: options?.systemPrompt,
		});
	}
	if (auth?.type === 'api' && auth.key) {
		const instance = createOpenAI({ apiKey: auth.key });
		return instance(model);
	}
	return openai(model);
}
