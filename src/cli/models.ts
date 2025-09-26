import {
	intro,
	outro,
	select,
	isCancel,
	cancel,
	log,
	text,
} from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';
import {
	catalog,
	type ProviderId,
	type ModelInfo,
} from '@/providers/catalog.ts';
import { getGlobalConfigDir, getGlobalConfigPath } from '@/config/paths.ts';
import { isProviderAuthorized } from '@/providers/authorization.ts';
import { runAuth } from '@/cli/auth.ts';

export async function runModels(
	opts: { project?: string; local?: boolean } = {},
) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);

	// Build list of authorized providers only
	const providers: ProviderId[] = [
		'openai',
		'anthropic',
		'google',
		'openrouter',
		'opencode',
	];
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
		const allProviders = [
			'openai',
			'anthropic',
			'google',
			'openrouter',
			'opencode',
		] as ProviderId[];
		const authz2 = await Promise.all(
			allProviders.map((p) => isProviderAuthorized(cfg2, p)),
		);
		const allowed2 = allProviders.filter((_, i) => authz2[i]);
		if (!allowed2.length) {
			log.error('No credentials added. Aborting.');
			return outro('');
		}
		// replace vars for subsequent logic
		allowed.length = 0;
		allowed.push(...allowed2);
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

	// Dedupe by id and sort for stable display
	const uniq: ModelInfo[] = [];
	const seen = new Set<string>();
	for (const m of models) {
		if (seen.has(m.id)) continue;
		seen.add(m.id);
		uniq.push(m);
	}
	uniq.sort((a, b) => {
		const la = (a.label || a.id).toLowerCase();
		const lb = (b.label || b.id).toLowerCase();
		return la < lb ? -1 : la > lb ? 1 : 0;
	});

	let filtered = uniq;
	// For large catalogs, allow an optional filter to narrow the list
	if (uniq.length > 50) {
		const browseMode = (await select({
			message: `This provider has ${uniq.length} models`,
			initialValue: 'full',
			options: [
				{ value: 'full', label: 'Browse full list' },
				{ value: 'filter', label: 'Filter by text' },
			],
		})) as 'full' | 'filter' | symbol;
		if (isCancel(browseMode)) return cancel('Cancelled');
		if (browseMode === 'filter') {
			const q = await text({
				message: `Filter ${uniq.length} models (leave blank for all)`,
				placeholder: 'e.g., claude, gpt-4o, reasoning',
			});
			if (!isCancel(q)) {
				const needle = String(q || '')
					.trim()
					.toLowerCase();
				if (needle.length) {
					filtered = uniq.filter((m) => {
						const label = (m.label || '').toLowerCase();
						const id = m.id.toLowerCase();
						return label.includes(needle) || id.includes(needle);
					});
					if (!filtered.length) {
						log.info('No matches for that filter. Showing full list.');
						filtered = uniq;
					}
				}
			}
		} else {
			filtered = uniq;
		}
	}

	const options = filtered.map((m) => ({
		value: m.id,
		label: m.label ? `${m.label} (${m.id})` : m.id,
	}));
	const initial = options.some((o) => o.value === cfg.defaults.model)
		? (cfg.defaults.model as string)
		: undefined;

	async function pagedSelect(
		items: Array<{ value: string; label: string }>,
		message: string,
		pageSize = 6,
		initialValue?: string,
	): Promise<string | symbol> {
		const total = items.length;
		if (total <= pageSize) {
			return (await select({ message, options: items, initialValue })) as
				| string
				| symbol;
		}
		const lastIndex = Math.max(
			0,
			items.findIndex((i) => i.value === initialValue),
		);
		let page = lastIndex > -1 ? Math.floor(lastIndex / pageSize) : 0;
		const totalPages = Math.ceil(total / pageSize);
		while (true) {
			const start = page * pageSize;
			const pageItems = items.slice(start, start + pageSize);
			const hasPrev = page > 0;
			const hasNext = page < totalPages - 1;
			const nav: Array<{ value: string; label: string }> = [];
			if (hasPrev) nav.push({ value: '__prev__', label: '‹ Previous' });
			nav.push(...pageItems.map((x) => ({ value: x.value, label: x.label })));
			if (hasNext) nav.push({ value: '__next__', label: 'Next ›' });
			const initOnPage = pageItems.some((i) => i.value === initialValue)
				? initialValue
				: undefined;
			const choice = (await select({
				message: `${message} (${page + 1}/${totalPages})`,
				options: nav,
				initialValue: initOnPage,
			})) as string | symbol;
			if (isCancel(choice)) return choice;
			if (choice === '__prev__') {
				page = Math.max(0, page - 1);
				continue;
			}
			if (choice === '__next__') {
				page = Math.min(totalPages - 1, page + 1);
				continue;
			}
			return choice;
		}
	}

	const model = (await pagedSelect(options, 'Model', 6, initial)) as
		| string
		| symbol;
	if (isCancel(model)) return cancel('Cancelled');

	// Write updated defaults: global by default, local when --local
	const targetLocal = !!opts.local;
	const enableProvider = <T extends Record<string, unknown>>(
		providers: T,
		name: ProviderId,
	): T => {
		const current = providers[name] as { enabled?: boolean } | undefined;
		return {
			...providers,
			[name]: { ...(current ?? {}), enabled: true },
		};
	};
	if (targetLocal) {
		const next = {
			projectRoot: cfg.projectRoot,
			defaults: {
				agent: cfg.defaults.agent,
				provider: provider as ProviderId,
				model: String(model),
			},
			providers: enableProvider(cfg.providers, provider as ProviderId),
			paths: cfg.paths,
		};
		const path = `${cfg.paths.dataDir}/config.json`;
		await Bun.write(path, JSON.stringify(next, null, 2));
	} else {
		const base = getGlobalConfigDir();
		const path = getGlobalConfigPath();
		const next = {
			defaults: {
				agent: cfg.defaults.agent,
				provider: provider as ProviderId,
				model: String(model),
			},
			providers: enableProvider(cfg.providers, provider as ProviderId),
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
