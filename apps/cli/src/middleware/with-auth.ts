import {
	loadConfig,
	isProviderAuthorized,
	type ProviderId,
} from '@ottocode/sdk';
import { runAuth } from '../auth.ts';

export type WithAuthOptions = {
	project?: string;
};

export async function ensureAuth(projectRoot: string): Promise<boolean> {
	let cfg = await loadConfig(projectRoot);
	const defaultProvider = cfg.defaults.provider as ProviderId;

	const checkAny = async (
		config: Awaited<ReturnType<typeof loadConfig>>,
	): Promise<boolean> => {
		const providers: ProviderId[] = [
			'openai',
			'anthropic',
			'google',
			'openrouter',
			'opencode',
			'setu',
		];
		const statuses = await Promise.all(
			providers.map((provider) => isProviderAuthorized(config, provider)),
		);
		return statuses.some(Boolean);
	};

	const defaultAuthorized = await isProviderAuthorized(cfg, defaultProvider);
	if (defaultAuthorized) return true;
	if (await checkAny(cfg)) return true;

	const authSuccess = await runAuth(['login', defaultProvider]);
	if (!authSuccess) {
		return false;
	}

	cfg = await loadConfig(projectRoot);
	return (
		(await isProviderAuthorized(cfg, defaultProvider)) || (await checkAny(cfg))
	);
}

export function withAuth<T extends WithAuthOptions>(
	handler: (opts: T) => Promise<void>,
): (opts: T) => Promise<void> {
	return async (opts: T) => {
		const projectRoot = opts.project ?? process.cwd();
		if (!(await ensureAuth(projectRoot))) {
			return;
		}
		await handler(opts);
	};
}
