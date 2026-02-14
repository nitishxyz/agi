import type { OttoConfig } from '@ottocode/sdk';
import { getAuth, createMinimaxModel } from '@ottocode/sdk';

export async function getMinimaxInstance(cfg: OttoConfig, model: string) {
	const auth = await getAuth('minimax', cfg.projectRoot);
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createMinimaxModel(model, { apiKey });
}
