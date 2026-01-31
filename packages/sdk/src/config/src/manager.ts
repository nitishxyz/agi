import { loadConfig } from './index.ts';
import {
	getAllAuth,
	setAuth as setAuthFile,
	removeAuth as removeAuthFile,
	type ProviderId,
	type AuthInfo,
} from '../../auth/src/index.ts';
import {
	getGlobalConfigDir,
	getGlobalConfigPath,
	getLocalDataDir,
	joinPath,
} from './paths.ts';
import {
	providerIds,
	readEnvKey,
	setEnvKey,
} from '../../providers/src/index.ts';

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
	if (info?.type === 'wallet' && info.secret) return true;
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
	const value =
		stored?.type === 'api'
			? stored.key
			: stored?.type === 'wallet'
				? stored.secret
				: undefined;
	if (value) setEnvKey(provider, value);
}

export async function writeDefaults(
	scope: Scope,
	updates: Partial<{
		agent: string;
		provider: ProviderId;
		model: string;
		toolApproval: 'auto' | 'dangerous' | 'all';
	}>,
	projectRoot?: string,
) {
	const root = projectRoot ? String(projectRoot) : process.cwd();

	if (scope === 'local') {
		const localDir = getLocalDataDir(root);
		const localPath = joinPath(localDir, 'config.json');
		const existing = await readJsonFile(localPath);
		const prevDefaults =
			existing && typeof existing.defaults === 'object'
				? (existing.defaults as Record<string, unknown>)
				: {};
		const next = {
			...existing,
			defaults: { ...prevDefaults, ...updates },
		};
		try {
			const { promises: fs } = await import('node:fs');
			await fs.mkdir(localDir, { recursive: true }).catch(() => {});
		} catch {}
		await Bun.write(localPath, JSON.stringify(next, null, 2));
		return;
	}

	const globalPath = getGlobalConfigPath();
	const existing = await readJsonFile(globalPath);
	const prevDefaults =
		existing && typeof existing.defaults === 'object'
			? (existing.defaults as Record<string, unknown>)
			: {};
	const next = {
		...existing,
		defaults: { ...prevDefaults, ...updates },
	};
	const base = getGlobalConfigDir();
	try {
		const { promises: fs } = await import('node:fs');
		await fs.mkdir(base, { recursive: true }).catch(() => {});
	} catch {}
	await Bun.write(globalPath, JSON.stringify(next, null, 2));
}

async function readJsonFile(
	filePath: string,
): Promise<Record<string, unknown> | undefined> {
	const f = Bun.file(filePath);
	if (!(await f.exists())) return undefined;
	try {
		const parsed = await f.json();
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return undefined;
	} catch {
		return undefined;
	}
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

export async function getOnboardingComplete(
	_projectRoot?: string,
): Promise<boolean> {
	const globalPath = getGlobalConfigPath();
	const f = Bun.file(globalPath);
	if (await f.exists()) {
		try {
			const data = await f.json();
			return data?.onboardingComplete === true;
		} catch {
			return false;
		}
	}
	return false;
}

export async function setOnboardingComplete(
	_projectRoot?: string,
): Promise<void> {
	const globalPath = getGlobalConfigPath();
	const base = getGlobalConfigDir();

	let existing: Record<string, unknown> = {};
	const f = Bun.file(globalPath);
	if (await f.exists()) {
		try {
			existing = (await f.json()) as Record<string, unknown>;
		} catch {}
	}

	const next = { ...existing, onboardingComplete: true };

	try {
		const { promises: fs } = await import('node:fs');
		await fs.mkdir(base, { recursive: true }).catch(() => {});
	} catch {}

	await Bun.write(globalPath, JSON.stringify(next, null, 2));
}
