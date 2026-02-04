import { getAuth, createCopilotModel } from '@ottocode/sdk';
import type { OttoConfig } from '@ottocode/sdk';

export async function resolveCopilotModel(model: string, cfg: OttoConfig) {
	const auth = await getAuth('copilot', cfg.projectRoot);
	if (auth?.type === 'oauth') {
		return createCopilotModel(model, { oauth: auth });
	}
	throw new Error(
		'Copilot provider requires OAuth. Run `otto auth login copilot`.',
	);
}
