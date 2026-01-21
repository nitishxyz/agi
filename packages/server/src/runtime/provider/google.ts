import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth } from '@agi-cli/sdk';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';

export async function resolveGoogleModel(model: string, cfg: AGIConfig) {
	const auth = await getAuth('google', cfg.projectRoot);
	if (auth?.type === 'api' && auth.key) {
		const instance = createGoogleGenerativeAI({ apiKey: auth.key });
		return instance(model);
	}
	return google(model);
}
