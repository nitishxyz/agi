import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth, createGoogleModel } from '@agi-cli/sdk';

export async function resolveGoogleModel(model: string, cfg: AGIConfig) {
	const auth = await getAuth('google', cfg.projectRoot);
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createGoogleModel(model, { apiKey });
}
