import { getAuth, createCopilotModel } from '@agi-cli/sdk';
import type { AGIConfig } from '@agi-cli/sdk';

export async function resolveCopilotModel(model: string, cfg: AGIConfig) {
	const auth = await getAuth('copilot', cfg.projectRoot);
	if (auth?.type === 'oauth') {
		return createCopilotModel(model, { oauth: auth });
	}
	throw new Error(
		'Copilot provider requires OAuth. Run `agi auth login copilot`.',
	);
}
