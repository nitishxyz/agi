import type { OttoConfig } from '@ottocode/sdk';
import { getAuth, createMoonshotModel } from '@ottocode/sdk';

export async function getMoonshotInstance(cfg: OttoConfig, model: string) {
	const auth = await getAuth('moonshot', cfg.projectRoot);
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createMoonshotModel(model, { apiKey });
}
