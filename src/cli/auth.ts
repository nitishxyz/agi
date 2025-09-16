import {
	intro,
	outro,
	select,
	password,
	isCancel,
	cancel,
	log,
} from '@clack/prompts';
import { box, table, colors } from '@/cli/ui.ts';
import {
	getAllAuth,
	setAuth,
	removeAuth,
	type ProviderId,
} from '@/auth/index.ts';
import { loadConfig } from '@/config/index.ts';
import { catalog } from '@/providers/catalog.ts';

const PROVIDER_LINKS: Record<
	ProviderId,
	{ name: string; url: string; env: string }
> = {
	openai: {
		name: 'OpenAI',
		url: 'https://platform.openai.com/api-keys',
		env: 'OPENAI_API_KEY',
	},
	anthropic: {
		name: 'Anthropic',
		url: 'https://console.anthropic.com/settings/keys',
		env: 'ANTHROPIC_API_KEY',
	},
	google: {
		name: 'Google AI Studio',
		url: 'https://aistudio.google.com/app/apikey',
		env: 'GOOGLE_GENERATIVE_AI_API_KEY',
	},
};

export async function runAuth(args: string[]) {
	const sub = args[0];
	if (sub === 'login') return runAuthLogin(args.slice(1));
	if (sub === 'list' || sub === 'ls') return runAuthList(args.slice(1));
	if (sub === 'logout' || sub === 'rm' || sub === 'remove')
		return runAuthLogout(args.slice(1));
	intro('agi auth');
	log.info('usage: agi auth login|list|logout');
	outro('');
}

export async function runAuthList(_args: string[]) {
	const cfg = await loadConfig(process.cwd());
	const all = await getAllAuth(cfg.projectRoot);
	const entries = Object.entries(all);
	const defProv = cfg.defaults.provider;
	const defModel = cfg.defaults.model;
	const rows = entries.map(([id, info]) => [
		id,
		info?.type ?? '-',
		id === defProv ? 'yes' : 'no',
		id === defProv ? defModel : '-',
	]);
	if (rows.length) {
		box('Credentials', []);
		table(['Provider', 'Type', 'Default', 'Model'], rows);
	} else {
		box('Credentials', [colors.dim('No stored credentials')]);
	}
	const envRows: string[] = [];
	const providerEntries = Object.entries(PROVIDER_LINKS) as Array<
		[ProviderId, (typeof PROVIDER_LINKS)[ProviderId]]
	>;
	for (const [pid, meta] of providerEntries) {
		if (process.env[meta.env]) envRows.push(`${pid} ${colors.dim(meta.env)}`);
	}
	if (envRows.length) box('Environment', envRows);
}

export async function runAuthLogin(_args: string[]) {
	const cfg = await loadConfig(process.cwd());
	const wantLocal = _args.includes('--local');
	intro('Add credential');
	const provider = (await select({
		message: 'Select provider',
		options: [
			{ value: 'openai', label: PROVIDER_LINKS.openai.name },
			{ value: 'anthropic', label: PROVIDER_LINKS.anthropic.name },
			{ value: 'google', label: PROVIDER_LINKS.google.name },
		],
	})) as ProviderId | symbol;
	if (isCancel(provider)) return cancel('Cancelled');
	const meta = PROVIDER_LINKS[provider as ProviderId];
	// All providers follow the same flow: show URL, then prompt for key
	// Default flow for OpenAI and Google: open key page and prompt to paste
	log.info(`Open in browser: ${meta.url}`);
	const key = await password({
		message: `Paste ${meta.env} here`,
		validate: (v) =>
			v && String(v).trim().length > 0 ? undefined : 'Required',
	});
	if (isCancel(key)) return cancel('Cancelled');
	// Store globally by default, or locally when --local is provided
	await setAuth(
		provider as ProviderId,
		{ type: 'api', key: String(key) },
		cfg.projectRoot,
		wantLocal ? 'local' : 'global',
	);
	await ensureGlobalConfigDefaults(provider as ProviderId);
	log.success('Saved');
	log.info(`Tip: you can also set ${meta.env} in your environment.`);
	outro('Done');
}

export async function runAuthLogout(_args: string[]) {
	const cfg = await loadConfig(process.cwd());
	const wantLocal = _args.includes('--local');
	const all = await getAllAuth(cfg.projectRoot);
	const entries = Object.keys(all) as ProviderId[];
	intro('Remove credential');
	if (!entries.length) {
		log.info('No stored credentials');
		return outro('');
	}
	const selected = (await select({
		message: 'Select provider',
		options: entries.map((id) => ({
			value: id,
			label: PROVIDER_LINKS[id].name,
		})),
	})) as ProviderId | symbol;
	if (isCancel(selected)) return cancel('Cancelled');
	await removeAuth(
		selected as ProviderId,
		cfg.projectRoot,
		wantLocal ? 'local' : 'global',
	);
	log.success(`Removed${wantLocal ? ' (local)' : ''}`);
	outro('');
}

async function ensureGlobalConfigDefaults(provider: ProviderId) {
	// Determine global config path
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const base = `${home}/.agi`.replace(/\\/g, '/');
	const path = `${base}/config.json`;
	// If a global config already exists, do not overwrite
	const f = Bun.file(path);
	if (await f.exists()) return;
	const models = catalog[provider]?.models ?? [];
	const defaultModel =
		models[0]?.id ||
		(provider === 'anthropic'
			? 'claude-3-haiku'
			: provider === 'openai'
				? 'gpt-4o-mini'
				: 'gemini-1.5-flash');
	const content = {
		defaults: { agent: 'build', provider, model: defaultModel },
		providers: {
			openai: { enabled: provider === 'openai' },
			anthropic: { enabled: provider === 'anthropic' },
			google: { enabled: provider === 'google' },
		},
	};
	// Ensure directory and write file
	try {
		const { promises: fs } = await import('node:fs');
		await fs.mkdir(base, { recursive: true }).catch(() => {});
	} catch {}
	await Bun.write(path, JSON.stringify(content, null, 2));
	try {
		const { promises: fs } = await import('node:fs');
		await fs.chmod(path, 0o600).catch(() => {});
	} catch {}
}
