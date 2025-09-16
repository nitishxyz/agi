import { loadConfig } from '@/config/index.ts';

export type ProviderId = 'openai' | 'anthropic' | 'google';

type ApiAuth = { type: 'api'; key: string };
type OAuthAuth = { type: 'oauth'; access: string; refresh?: string; expires?: number };
export type AuthInfo = ApiAuth | OAuthAuth; // room for wellknown later

type AuthFile = Partial<Record<ProviderId, AuthInfo>>;

function globalAuthPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.agi/auth.json`.replace(/\\/g, '/');
}

async function localAuthPath(projectRoot?: string) {
  const cfg = await loadConfig(projectRoot);
  return `${cfg.paths.dataDir}/auth.json`;
}

export async function getAllAuth(projectRoot?: string): Promise<AuthFile> {
  // Merge global then local (local overrides global)
  const globalFile = Bun.file(globalAuthPath());
  const localFile = Bun.file(await localAuthPath(projectRoot));
  const globalData = (await globalFile.json().catch(() => ({}))) as AuthFile;
  const localData = (await localFile.json().catch(() => ({}))) as AuthFile;
  return { ...globalData, ...localData };
}

export async function getAuth(provider: ProviderId, projectRoot?: string): Promise<AuthInfo | undefined> {
  const all = await getAllAuth(projectRoot);
  return all[provider];
}

// scope: 'global' (default) or 'local'
export async function setAuth(provider: ProviderId, info: AuthInfo, projectRoot?: string, scope: 'global' | 'local' = 'global') {
  const path = scope === 'local' ? await localAuthPath(projectRoot) : globalAuthPath();
  const f = Bun.file(path);
  const existing = ((await f.json().catch(() => ({}))) || {}) as AuthFile;
  const next: AuthFile = { ...existing, [provider]: info };
  // Ensure directory exists for global path
  if (scope === 'global') {
    const base = path.slice(0, path.lastIndexOf('/')) || '.';
    try {
      const { promises: fs } = await import('node:fs');
      await fs.mkdir(base, { recursive: true }).catch(() => {});
    } catch {}
  }
  await Bun.write(path, JSON.stringify(next, null, 2));
  try {
    const { promises: fs } = await import('node:fs');
    await fs.chmod(path, 0o600).catch(() => {});
  } catch {}
}

export async function removeAuth(provider: ProviderId, projectRoot?: string, scope: 'global' | 'local' = 'global') {
  const path = scope === 'local' ? await localAuthPath(projectRoot) : globalAuthPath();
  const f = Bun.file(path);
  const existing = ((await f.json().catch(() => ({}))) || {}) as AuthFile;
  delete existing[provider];
  await Bun.write(path, JSON.stringify(existing, null, 2));
  try {
    const { promises: fs } = await import('node:fs');
    await fs.chmod(path, 0o600).catch(() => {});
  } catch {}
}
