import { intro, outro, select, isCancel, cancel, log } from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';
import { catalog, type ProviderId } from '@/providers/catalog.ts';
import { isProviderAuthorized } from '@/providers/authz.ts';

export async function runModels(opts: { project?: string } = {}) {
  const projectRoot = opts.project ?? process.cwd();
  const cfg = await loadConfig(projectRoot);

  // Build list of authorized providers only
  const providers: ProviderId[] = ['openai', 'anthropic', 'google'];
  const authz = await Promise.all(providers.map((p) => isProviderAuthorized(cfg, p)));
  const allowed = providers.filter((_, i) => authz[i]);

  intro('Select provider and model');
  if (!allowed.length) {
    log.error('No providers configured. Run `agi auth login` first.');
    return outro('');
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
    options: models.map((m) => ({ value: m.id, label: m.label ? `${m.label} (${m.id})` : m.id })),
    initialValue: cfg.defaults.model,
  })) as string | symbol;
  if (isCancel(model)) return cancel('Cancelled');

  // Write updated defaults to project config
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
  log.success(`Set default provider=${String(provider)} model=${String(model)}`);
  outro('Done');
}

