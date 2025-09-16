import { loadConfig } from '@/config/index.ts';
import { getAllAuth, setAuth as setAuthFile, removeAuth as removeAuthFile, type ProviderId, type AuthInfo } from '@/auth/index.ts';

export type Scope = 'global' | 'local';

export async function read(projectRoot?: string) {
  const cfg = await loadConfig(projectRoot);
  const auth = await getAllAuth(projectRoot);
  return { cfg, auth };
}

export async function isAuthorized(provider: ProviderId, projectRoot?: string): Promise<boolean> {
  if (provider === 'openai' && process.env.OPENAI_API_KEY) return true;
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return true;
  if (provider === 'google' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return true;
  const { cfg, auth } = await read(projectRoot);
  if (auth[provider]?.type === 'api' && (auth[provider] as any).key) return true;
  // legacy fallback to config apiKey
  if (provider === 'openai' && cfg.providers.openai?.apiKey) return true;
  if (provider === 'anthropic' && cfg.providers.anthropic?.apiKey) return true;
  if (provider === 'google' && cfg.providers.google?.apiKey) return true;
  return false;
}

export async function ensureEnv(provider: ProviderId, projectRoot?: string): Promise<void> {
  const { cfg, auth } = await read(projectRoot);
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    const key = (auth.openai as any)?.key || cfg.providers.openai?.apiKey;
    if (key) process.env.OPENAI_API_KEY = key;
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    const key = (auth.anthropic as any)?.key || cfg.providers.anthropic?.apiKey;
    if (key) process.env.ANTHROPIC_API_KEY = key;
  }
  if (provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const key = (auth.google as any)?.key || cfg.providers.google?.apiKey;
    if (key) process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  }
}

export async function writeDefaults(scope: Scope, updates: Partial<{ agent: string; provider: ProviderId; model: string }>, projectRoot?: string) {
  const { cfg } = await read(projectRoot);
  if (scope === 'local') {
    const next = {
      projectRoot: cfg.projectRoot,
      defaults: {
        agent: updates.agent ?? cfg.defaults.agent,
        provider: (updates.provider ?? cfg.defaults.provider) as ProviderId,
        model: updates.model ?? cfg.defaults.model,
      },
      providers: cfg.providers,
      paths: cfg.paths,
    };
    const path = `${cfg.paths.dataDir}/config.json`;
    await Bun.write(path, JSON.stringify(next, null, 2));
    return;
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const base = `${home}/.agi`.replace(/\\/g, '/');
  const path = `${base}/config.json`;
  const next = {
    defaults: {
      agent: updates.agent ?? cfg.defaults.agent,
      provider: (updates.provider ?? cfg.defaults.provider) as ProviderId,
      model: updates.model ?? cfg.defaults.model,
    },
    providers: cfg.providers,
  };
  try {
    const { promises: fs } = await import('node:fs');
    await fs.mkdir(base, { recursive: true }).catch(() => {});
  } catch {}
  await Bun.write(path, JSON.stringify(next, null, 2));
}

export async function writeAuth(provider: ProviderId, info: AuthInfo, scope: Scope = 'global', projectRoot?: string) {
  await setAuthFile(provider, info, projectRoot, scope);
}

export async function removeAuth(provider: ProviderId, scope: Scope = 'global', projectRoot?: string) {
  await removeAuthFile(provider, projectRoot, scope);
}
