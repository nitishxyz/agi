import { loadConfig } from '@/config/index.ts';

export type ProviderId = 'openai' | 'anthropic' | 'google';

type ApiAuth = { type: 'api'; key: string };
type OAuthAuth = { type: 'oauth'; access: string; refresh?: string; expires?: number };
export type AuthInfo = ApiAuth | OAuthAuth; // room for wellknown later

type AuthFile = Partial<Record<ProviderId, AuthInfo>>;

async function authFilePath(projectRoot?: string) {
  const cfg = await loadConfig(projectRoot);
  return `${cfg.paths.dataDir}/auth.json`;
}

export async function getAllAuth(projectRoot?: string): Promise<AuthFile> {
  const path = await authFilePath(projectRoot);
  const f = Bun.file(path);
  return (await f.json().catch(() => ({}))) as AuthFile;
}

export async function getAuth(provider: ProviderId, projectRoot?: string): Promise<AuthInfo | undefined> {
  const all = await getAllAuth(projectRoot);
  return all[provider];
}

export async function setAuth(provider: ProviderId, info: AuthInfo, projectRoot?: string) {
  const path = await authFilePath(projectRoot);
  const existing = await getAllAuth(projectRoot);
  const next: AuthFile = { ...existing, [provider]: info };
  await Bun.write(path, JSON.stringify(next, null, 2));
  try {
    const { promises: fs } = await import('node:fs');
    await fs.chmod(path, 0o600).catch(() => {});
  } catch {}
}

export async function removeAuth(provider: ProviderId, projectRoot?: string) {
  const path = await authFilePath(projectRoot);
  const existing = await getAllAuth(projectRoot);
  delete existing[provider];
  await Bun.write(path, JSON.stringify(existing, null, 2));
  try {
    const { promises: fs } = await import('node:fs');
    await fs.chmod(path, 0o600).catch(() => {});
  } catch {}
}
