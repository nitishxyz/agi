import { getSecureAuthPath, ensureDir } from '@/config/paths.ts';

export type ProviderId = 'openai' | 'anthropic' | 'google';

type ApiAuth = { type: 'api'; key: string };
type OAuthAuth = {
	type: 'oauth';
	access: string;
	refresh?: string;
	expires?: number;
};
export type AuthInfo = ApiAuth | OAuthAuth; // room for wellknown later

type AuthFile = Partial<Record<ProviderId, AuthInfo>>;

function globalAuthPath(): string {
  return getSecureAuthPath();
}

// Local auth is no longer supported for security; use only global secure path

export async function getAllAuth(_projectRoot?: string): Promise<AuthFile> {
  // Only the secure global auth file is used
  const globalFile = Bun.file(globalAuthPath());
  const globalData = (await globalFile.json().catch(() => ({}))) as AuthFile;
  return { ...globalData };
}

export async function getAuth(
	provider: ProviderId,
	projectRoot?: string,
): Promise<AuthInfo | undefined> {
	const all = await getAllAuth(projectRoot);
	return all[provider];
}

// scope: 'global' (default) or 'local'
export async function setAuth(
	provider: ProviderId,
	info: AuthInfo,
	_projectRoot?: string,
	_scope: 'global' | 'local' = 'global',
) {
	const path = globalAuthPath();
	const f = Bun.file(path);
	const existing = ((await f.json().catch(() => ({}))) || {}) as AuthFile;
	const next: AuthFile = { ...existing, [provider]: info };
	// Ensure directory exists for global path
	const base = path.slice(0, path.lastIndexOf('/')) || '.';
	await ensureDir(base);
	await Bun.write(path, JSON.stringify(next, null, 2));
	try {
		const { promises: fs } = await import('node:fs');
		await fs.chmod(path, 0o600).catch(() => {});
	} catch {}
}

export async function removeAuth(
	provider: ProviderId,
	_projectRoot?: string,
	_scope: 'global' | 'local' = 'global',
) {
	const path = globalAuthPath();
	const f = Bun.file(path);
	const existing = ((await f.json().catch(() => ({}))) || {}) as AuthFile;
	delete existing[provider];
	await Bun.write(path, JSON.stringify(existing, null, 2));
	try {
		const { promises: fs } = await import('node:fs');
		await fs.chmod(path, 0o600).catch(() => {});
	} catch {}
}
