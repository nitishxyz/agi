import { isAuthorized as mgrIsAuthorized, ensureEnv as mgrEnsureEnv } from '@/config/manager.ts';
import type { AGIConfig } from '@/config/index.ts';

export async function isProviderAuthorized(cfg: AGIConfig, provider: 'openai' | 'anthropic' | 'google') {
  return await mgrIsAuthorized(provider, cfg.projectRoot);
}

export async function ensureProviderEnv(cfg: AGIConfig, provider: 'openai' | 'anthropic' | 'google') {
  await mgrEnsureEnv(provider, cfg.projectRoot);
}
