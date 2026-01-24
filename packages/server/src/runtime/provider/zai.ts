import type { AGIConfig } from '@agi-cli/sdk';
import { getAuth, createZaiModel, createZaiCodingModel } from '@agi-cli/sdk';

export async function getZaiInstance(cfg: AGIConfig, model: string) {
	const auth = await getAuth('zai', cfg.projectRoot);
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createZaiModel(model, { apiKey });
}

export async function getZaiCodingInstance(cfg: AGIConfig, model: string) {
	const auth =
		(await getAuth('zai', cfg.projectRoot)) ||
		(await getAuth('zai-coding', cfg.projectRoot));
	const apiKey = auth?.type === 'api' ? auth.key : undefined;
	return createZaiCodingModel(model, { apiKey });
}
