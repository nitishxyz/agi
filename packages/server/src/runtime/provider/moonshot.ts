import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth, createMoonshotModel } from '@agi-cli/sdk';

export async function getMoonshotInstance(cfg: AGIConfig, model: string) {
	const auth = await getAuth('moonshot', cfg.projectRoot);
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createMoonshotModel(model, { apiKey });
}
