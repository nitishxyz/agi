import {
	isAuthorized as mgrIsAuthorized,
	ensureEnv as mgrEnsureEnv,
} from '@/config/manager.ts';
import type { AGIConfig } from '@/config/index.ts';
import type { ProviderId } from '@/auth/index.ts';

export async function isProviderAuthorized(
	cfg: AGIConfig,
	provider: ProviderId,
) {
	return await mgrIsAuthorized(provider, cfg.projectRoot);
}

export async function ensureProviderEnv(cfg: AGIConfig, provider: ProviderId) {
	await mgrEnsureEnv(provider, cfg.projectRoot);
}
