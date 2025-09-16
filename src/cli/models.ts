import { intro, outro, select, isCancel, cancel, log } from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';
import { catalog, type ProviderId } from '@/providers/catalog.ts';
import { isProviderAuthorized } from '@/providers/authorization.ts';
import { runAuth } from '@/cli/auth.ts';

export async function runModels(opts: { project?: string; local?: boolean } = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);

	// Build list of authorized providers only
	const providers: ProviderId[] = ['openai', 'anthropic', 'google'];
	const authorization = await Promise.all(
		providers.map((p) => isProviderAuthorized(cfg, p)),
	);
	const allowed = providers.filter((_, i) => authorization[i]);

  intro('Select provider and model');
  if (!allowed.length) {
    log.info('No providers configured. Launching auth…');
    await runAuth(['login']);
    // Recompute allowed after auth
    const cfg2 = await loadConfig(projectRoot);
    const authz2 = await Promise.all((['openai','anthropic','google'] as ProviderId[]).map((p) => isProviderAuthorized(cfg2, p)));
    const allowed2 = (['openai','anthropic','google'] as ProviderId[]).filter((_, i) => authz2[i]);
    if (!allowed2.length) {
      log.error('No credentials added. Aborting.');
      return outro('');
    }
    // replace vars for subsequent logic
    (allowed as any).splice(0, allowed.length, ...allowed2);
  }

	const provider = (await select({
		message: 'Provider',
		options: allowed.map((p) => ({ value: p, label: p })),
		initialValue: cfg.defaults.provider,
	})) as ProviderId | symbol;
	if (isCancel(provider)) return cancel('Cancelled');

	const models = catalog[provider as ProviderId]?.models ?? [];
	if (!models.length) {
		log.error('No models available for this provider.');
		return outro('');
	}
	const model = (await select({
		message: 'Model',
		options: models.map((m) => ({
			value: m.id,
			label: m.label ? `${m.label} (${m.id})` : m.id,
		})),
		initialValue: cfg.defaults.model,
	})) as string | symbol;
	if (isCancel(model)) return cancel('Cancelled');

	// Write updated defaults: global by default, local when --local
	const targetLocal = !!opts.local;
	if (targetLocal) {
		const next = {
			projectRoot: cfg.projectRoot,
			defaults: {
				agent: cfg.defaults.agent,
				provider: provider as ProviderId,
				model: String(model),
			},
			providers: cfg.providers,
			paths: cfg.paths,
		};
		const path = `${cfg.paths.dataDir}/config.json`;
		await Bun.write(path, JSON.stringify(next, null, 2));
	} else {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const base = `${home}/.agi`.replace(/\\/g, '/');
    const path = `${base}/config.json`;
		const next = {
			defaults: {
				agent: cfg.defaults.agent,
				provider: provider as ProviderId,
				model: String(model),
			},
			providers: cfg.providers,
		};
		try {
			const { promises: fs } = await import('node:fs');
			await fs.mkdir(base, { recursive: true }).catch(() => {});
		} catch {}
		await Bun.write(path, JSON.stringify(next, null, 2));
	}
	log.success(
		`Set default (${targetLocal ? 'local' : 'global'}) provider=${String(
			provider,
		)} model=${String(model)}`,
	);
	outro('Done');
}
