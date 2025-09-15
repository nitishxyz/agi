import type { AGIConfig } from '@/config/index.ts';
import { getAuth } from '@/auth/index.ts';

export async function isProviderAuthorized(cfg: AGIConfig, provider: 'openai' | 'anthropic' | 'google') {
  if (provider === 'openai') {
    if (process.env.OPENAI_API_KEY) return true;
    const auth = await getAuth('openai', cfg.projectRoot);
    if (auth?.type === 'api' && auth.key) return true;
    if (cfg.providers.openai?.apiKey) return true;
    return false;
  }
  if (provider === 'anthropic') {
    if (process.env.ANTHROPIC_API_KEY) return true;
    const auth = await getAuth('anthropic', cfg.projectRoot);
    if (auth?.type === 'api' && auth.key) return true;
    if (cfg.providers.anthropic?.apiKey) return true;
    return false;
  }
  if (provider === 'google') {
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return true;
    const auth = await getAuth('google', cfg.projectRoot);
    if (auth?.type === 'api' && auth.key) return true;
    if (cfg.providers.google?.apiKey) return true;
    return false;
  }
  return false;
}

export async function ensureProviderEnv(cfg: AGIConfig, provider: 'openai' | 'anthropic' | 'google') {
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    const a = await getAuth('openai', cfg.projectRoot);
    if (a?.type === 'api' && a.key) process.env.OPENAI_API_KEY = a.key;
    else if (cfg.providers.openai?.apiKey) process.env.OPENAI_API_KEY = cfg.providers.openai.apiKey;
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    const a = await getAuth('anthropic', cfg.projectRoot);
    if (a?.type === 'api' && a.key) process.env.ANTHROPIC_API_KEY = a.key;
    else if (cfg.providers.anthropic?.apiKey) process.env.ANTHROPIC_API_KEY = cfg.providers.anthropic.apiKey;
  }
  if (provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const a = await getAuth('google', cfg.projectRoot);
    if (a?.type === 'api' && a.key) process.env.GOOGLE_GENERATIVE_AI_API_KEY = a.key;
    else if (cfg.providers.google?.apiKey) process.env.GOOGLE_GENERATIVE_AI_API_KEY = cfg.providers.google.apiKey;
  }
}
