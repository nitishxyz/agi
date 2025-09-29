import { loadConfig } from '@/config/index.ts';
import {
	getAllAuth,
	setAuth as setAuthFile,
	removeAuth as removeAuthFile,
	type ProviderId,
	type AuthInfo,
} from '@/auth/index.ts';
import { getGlobalConfigDir, getGlobalConfigPath } from '@/config/paths.ts';
import { providerIds } from '@/providers/utils.ts';
import { readEnvKey, setEnvKey } from '@/providers/env.ts';

export type Scope = 'global' | 'local';

export async function read(projectRoot?: string) {
	const cfg = await loadConfig(projectRoot);
	const auth = await getAllAuth(projectRoot);
	return { cfg, auth };
}

export async function isAuthorized(
	provider: ProviderId,
	projectRoot?: string,
): Promise<boolean> {
	if (!providerIds.includes(provider)) return false;
	if (readEnvKey(provider)) return true;
	const { auth } = await read(projectRoot);
	const info = auth[provider];
	if (info?.type === 'api' && info.key) return true;
	if (info?.type === 'oauth' && info.refresh && info.access) return true;
	return false;
}

export async function ensureEnv(
	provider: ProviderId,
	projectRoot?: string,
): Promise<void> {
	if (!providerIds.includes(provider)) return;
	if (readEnvKey(provider)) return;
	const { auth } = await read(projectRoot);
	const stored = auth[provider];
	const key = stored?.type === 'api' ? stored.key : undefined;
	if (key) setEnvKey(provider, key);
}

export async function writeDefaults(
	scope: Scope,
	updates: Partial<{ agent: string; provider: ProviderId; model: string }>,
	projectRoot?: string,
) {
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
	const base = getGlobalConfigDir();
	const path = getGlobalConfigPath();
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

export async function writeAuth(
	provider: ProviderId,
	info: AuthInfo,
	scope: Scope = 'global',
	projectRoot?: string,
) {
	await setAuthFile(provider, info, projectRoot, scope);
}

export async function removeAuth(
	provider: ProviderId,
	scope: Scope = 'global',
	projectRoot?: string,
) {
	await removeAuthFile(provider, projectRoot, scope);
}
