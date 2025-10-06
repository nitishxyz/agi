import {
	isAuthorized as mgrIsAuthorized,
	ensureEnv as mgrEnsureEnv,
} from '@agi-cli/config';
import type { AGIConfig } from '@agi-cli/config';
import type { ProviderId } from '@agi-cli/types';

export async function isProviderAuthorized(
	cfg: AGIConfig,
	provider: ProviderId,
) {
	return await mgrIsAuthorized(provider, cfg.projectRoot);
}

export async function ensureProviderEnv(cfg: AGIConfig, provider: ProviderId) {
	await mgrEnsureEnv(provider, cfg.projectRoot);
}
