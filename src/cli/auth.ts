import {
	intro,
	outro,
	select,
	password,
	isCancel,
	cancel,
	log,
	text,
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
import { getGlobalConfigDir, getGlobalConfigPath } from '@/config/paths.ts';
import {
	authorize,
	exchange,
	openAuthUrl,
	createApiKey,
} from '@/auth/oauth.ts';

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
	openrouter: {
		name: 'OpenRouter',
		url: 'https://openrouter.ai/keys',
		env: 'OPENROUTER_API_KEY',
	},
	opencode: {
		name: 'OpenCode',
		url: 'https://opencode.ai',
		env: 'OPENCODE_API_KEY',
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
			{ value: 'openrouter', label: PROVIDER_LINKS.openrouter.name },
			{ value: 'opencode', label: PROVIDER_LINKS.opencode.name },
		],
	})) as ProviderId | symbol;
	if (isCancel(provider)) return cancel('Cancelled');

	if (provider === 'anthropic') {
		return await runAuthLoginAnthropic(cfg, wantLocal);
	}

	const meta = PROVIDER_LINKS[provider as ProviderId];
	log.info(`Open in browser: ${meta.url}`);
	const key = await password({
		message: `Paste ${meta.env} here`,
		validate: (v) =>
			v && String(v).trim().length > 0 ? undefined : 'Required',
	});
	if (isCancel(key)) return cancel('Cancelled');
	await setAuth(
		provider as ProviderId,
		{ type: 'api', key: String(key) },
		cfg.projectRoot,
		'global',
	);
	if (wantLocal)
		log.warn(
			'Local credential storage is disabled; saved to secure global location.',
		);
	await ensureGlobalConfigDefaults(provider as ProviderId);
	log.success('Saved');
	log.info(`Tip: you can also set ${meta.env} in your environment.`);
	outro('Done');
}

async function runAuthLoginAnthropic(
	cfg: Awaited<ReturnType<typeof loadConfig>>,
	wantLocal: boolean,
) {
	try {
		const authMethod = (await select({
			message: 'Select authentication method',
			options: [
				{ value: 'max', label: 'Claude Pro/Max (Free with subscription)' },
				{ value: 'console', label: 'Create API Key (Console OAuth)' },
				{ value: 'manual', label: 'Manually enter API Key' },
			],
		})) as 'max' | 'console' | 'manual' | symbol;

		if (isCancel(authMethod)) return cancel('Cancelled');

		if (authMethod === 'manual') {
			const meta = PROVIDER_LINKS.anthropic;
			log.info(`Open in browser: ${meta.url}`);
			const key = await password({
				message: `Paste ${meta.env} here`,
				validate: (v) =>
					v && String(v).trim().length > 0 ? undefined : 'Required',
			});
			if (isCancel(key)) return cancel('Cancelled');
			await setAuth(
				'anthropic',
				{ type: 'api', key: String(key) },
				cfg.projectRoot,
				'global',
			);
			if (wantLocal)
				log.warn(
					'Local credential storage is disabled; saved to secure global location.',
				);
			await ensureGlobalConfigDefaults('anthropic');
			log.success('Saved');
			log.info(
				`Tip: you can also set ${PROVIDER_LINKS.anthropic.env} in your environment.`,
			);
			return outro('Done');
		}

		const oauthMode: 'max' | 'console' =
			authMethod === 'console' ? 'console' : 'max';
		const { url, verifier } = await authorize(oauthMode);

		log.info('Opening browser for authorization...');
		log.info(`URL: ${url}\n`);

		const opened = await openAuthUrl(url);
		if (!opened) {
			log.warn(
				'⚠️  Could not open browser automatically. Please visit the URL above manually.\n',
			);
		}

		log.info("After authorizing, you'll be redirected to a URL like:");
		log.info(
			'https://console.anthropic.com/oauth/code/callback?code=ABC123#XYZ789&state=...\n',
		);

		const code = await text({
			message: 'Paste the full code (including the part after #):',
			validate: (v) =>
				v && String(v).includes('#') ? undefined : 'Code must include #',
		});

		if (isCancel(code) || !code) return cancel('Cancelled');

		log.info('\n🔄 Exchanging authorization code for tokens...');

		try {
			const tokens = await exchange(String(code), verifier);

			if (oauthMode === 'console') {
				log.info('🔑 Creating API key...');
				const apiKey = await createApiKey(tokens.access);
				await setAuth(
					'anthropic',
					{ type: 'api', key: apiKey },
					cfg.projectRoot,
					'global',
				);
				log.success('API key created and saved!');
			} else {
				await setAuth(
					'anthropic',
					{
						type: 'oauth',
						refresh: tokens.refresh,
						access: tokens.access,
						expires: tokens.expires,
					},
					cfg.projectRoot,
					'global',
				);
				log.success('OAuth tokens saved!');
				log.info(`Token expires: ${new Date(tokens.expires).toLocaleString()}`);
			}

			if (wantLocal)
				log.warn(
					'Local credential storage is disabled; saved to secure global location.',
				);

			await ensureGlobalConfigDefaults('anthropic');
			outro('Done');
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : 'Unknown error occurred';
			log.error(`Authentication failed: ${message}`);
			outro('Failed');
		}
	} catch (error: unknown) {
		const message =
			error instanceof Error
				? `${error.message}\n${error.stack || ''}`
				: String(error);
		console.error('\n[ERROR] Caught in runAuthLoginAnthropic:', message);
		log.error(`Failed to initialize authentication: ${message}`);
		outro('Failed');
		process.exit(1);
	}
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
	await removeAuth(selected as ProviderId, cfg.projectRoot, 'global');
	if (wantLocal)
		log.warn(
			'Local credential storage is disabled; removed from secure global location.',
		);
	log.success('Removed');
	outro('');
}

async function ensureGlobalConfigDefaults(provider: ProviderId) {
	// Determine global config path (XDG config)
	const base = getGlobalConfigDir();
	const path = getGlobalConfigPath();
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
				: provider === 'google'
					? 'gemini-1.5-flash'
					: 'anthropic/claude-3.5-sonnet');
	const content = {
		defaults: { agent: 'build', provider, model: defaultModel },
		providers: {
			openai: { enabled: provider === 'openai' },
			anthropic: { enabled: provider === 'anthropic' },
			google: { enabled: provider === 'google' },
			openrouter: { enabled: provider === 'openrouter' },
			opencode: { enabled: provider === 'opencode' },
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
