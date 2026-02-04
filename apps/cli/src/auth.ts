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
import { box, table, colors } from './ui.ts';
import {
	getAllAuth,
	setAuth,
	removeAuth,
	type ProviderId,
	authorize,
	exchange,
	openAuthUrl,
	createApiKey,
	providerIds,
	authorizeOpenAI,
	exchangeOpenAI,
	openOpenAIAuthUrl,
	obtainOpenAIApiKey,
	generateWallet,
	importWallet,
	authorizeCopilot,
	pollForCopilotToken,
	openCopilotAuthUrl,
} from '@ottocode/sdk';
import { loadConfig } from '@ottocode/sdk';
import { catalog } from '@ottocode/sdk';
import { getGlobalConfigDir, getGlobalConfigPath } from '@ottocode/sdk';

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
	setu: {
		name: 'Setu',
		url: 'https://setu.ottocode.io',
		env: 'SETU_PRIVATE_KEY',
	},
	zai: {
		name: 'Z.AI (GLM)',
		url: 'https://z.ai/manage-apikey/apikey-list',
		env: 'ZAI_API_KEY',
	},
	'zai-coding': {
		name: 'Z.AI Coding Plan',
		url: 'https://z.ai/manage-apikey/apikey-list',
		env: 'ZAI_API_KEY',
	},
	moonshot: {
		name: 'Moonshot AI (Kimi)',
		url: 'https://platform.moonshot.ai/console/api-keys',
		env: 'MOONSHOT_API_KEY',
	},
	copilot: {
		name: 'GitHub Copilot',
		url: 'https://github.com/features/copilot',
		env: 'GITHUB_TOKEN',
	},
};

export async function runAuth(args: string[]) {
	const sub = args[0];
	if (sub === 'login') return await runAuthLogin(args.slice(1));
	if (sub === 'list' || sub === 'ls') return await runAuthList(args.slice(1));
	if (sub === 'logout' || sub === 'rm' || sub === 'remove')
		return await runAuthLogout(args.slice(1));
	intro('otto auth');
	log.info('usage: otto auth login|list|logout');
	outro('');
	return false;
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

export async function runAuthLogin(_args: string[]): Promise<boolean> {
	const cfg = await loadConfig(process.cwd());
	const wantLocal = _args.includes('--local');
	const providerArg = _args.find((arg) =>
		(providerIds as readonly string[]).includes(arg as ProviderId),
	) as ProviderId | undefined;
	intro('Add credential');
	let provider: ProviderId;
	if (providerArg) {
		provider = providerArg;
	} else {
		const selected = (await select({
			message: 'Select provider',
			options: [
				{ value: 'openai', label: PROVIDER_LINKS.openai.name },
				{ value: 'anthropic', label: PROVIDER_LINKS.anthropic.name },
				{ value: 'google', label: PROVIDER_LINKS.google.name },
				{ value: 'openrouter', label: PROVIDER_LINKS.openrouter.name },
				{ value: 'opencode', label: PROVIDER_LINKS.opencode.name },
				{ value: 'copilot', label: PROVIDER_LINKS.copilot.name },
				{ value: 'setu', label: PROVIDER_LINKS.setu.name },
				{ value: 'zai', label: PROVIDER_LINKS.zai.name },
				{ value: 'zai-coding', label: PROVIDER_LINKS['zai-coding'].name },
				{ value: 'moonshot', label: PROVIDER_LINKS.moonshot.name },
			],
		})) as ProviderId | symbol;
		if (isCancel(selected)) {
			cancel('Cancelled');
			return false;
		}
		provider = selected as ProviderId;
	}

	if (provider === 'anthropic') {
		return runAuthLoginAnthropic(cfg, wantLocal);
	}

	if (provider === 'openai') {
		return runAuthLoginOpenAI(cfg, wantLocal);
	}

	if (provider === 'setu') {
		return runAuthLoginSetu(cfg, wantLocal);
	}

	if (provider === 'copilot') {
		return runAuthLoginCopilot(cfg, wantLocal);
	}

	const meta = PROVIDER_LINKS[provider];
	log.info(`Open in browser: ${meta.url}`);
	const key = await password({
		message: `Paste ${meta.env} here`,
		validate: (v) =>
			v && String(v).trim().length > 0 ? undefined : 'Required',
	});
	if (isCancel(key)) {
		cancel('Cancelled');
		return false;
	}
	await setAuth(
		provider,
		{ type: 'api', key: String(key) },
		cfg.projectRoot,
		'global',
	);
	if (wantLocal)
		log.warn(
			'Local credential storage is disabled; saved to secure global location.',
		);
	await ensureGlobalConfigDefaults(provider);
	log.success('Saved');
	log.info(`Tip: you can also set ${meta.env} in your environment.`);
	outro('Done');
	return true;
}

async function runAuthLoginOpenAI(
	cfg: Awaited<ReturnType<typeof loadConfig>>,
	wantLocal: boolean,
): Promise<boolean> {
	try {
		const authMethod = (await select({
			message: 'Select authentication method',
			options: [
				{
					value: 'oauth',
					label: 'ChatGPT Plus/Pro (Free with subscription)',
				},
				{ value: 'manual', label: 'Manually enter API Key' },
			],
		})) as 'oauth' | 'manual' | symbol;

		if (isCancel(authMethod)) {
			cancel('Cancelled');
			return false;
		}

		if (authMethod === 'manual') {
			const meta = PROVIDER_LINKS.openai;
			log.info(`Open in browser: ${meta.url}`);
			const key = await password({
				message: `Paste ${meta.env} here`,
				validate: (v) =>
					v && String(v).trim().length > 0 ? undefined : 'Required',
			});
			if (isCancel(key)) {
				cancel('Cancelled');
				return false;
			}
			await setAuth(
				'openai',
				{ type: 'api', key: String(key) },
				cfg.projectRoot,
				'global',
			);
			if (wantLocal)
				log.warn(
					'Local credential storage is disabled; saved to secure global location.',
				);
			await ensureGlobalConfigDefaults('openai');
			log.success('Saved');
			log.info(
				`Tip: you can also set ${PROVIDER_LINKS.openai.env} in your environment.`,
			);
			outro('Done');
			return true;
		}

		log.info('Starting OpenAI OAuth flow...');
		log.info(
			'⚠️  If the official Codex CLI is running, please stop it first (both use port 1455).\n',
		);

		const oauthResult = await authorizeOpenAI();

		log.info('Opening browser for authorization...');
		log.info(`URL: ${oauthResult.url}\n`);

		const opened = await openOpenAIAuthUrl(oauthResult.url);
		if (!opened) {
			log.warn(
				'⚠️  Could not open browser automatically. Please visit the URL above manually.\n',
			);
		}

		log.info('Waiting for authorization callback...');
		log.info('(Complete the login in your browser)\n');

		try {
			const code = await oauthResult.waitForCallback();
			oauthResult.close();

			log.info('🔄 Exchanging authorization code for tokens...');

			const tokens = await exchangeOpenAI(code, oauthResult.verifier);

			let useApiKey = false;
			let apiKey = '';

			try {
				log.info('🔑 Trying to obtain API key...');
				apiKey = await obtainOpenAIApiKey(tokens.idToken);
				useApiKey = true;
			} catch {
				log.info(
					'ℹ️  API key not available (no OpenAI Platform org). Using OAuth tokens.',
				);
			}

			if (useApiKey && apiKey) {
				await setAuth(
					'openai',
					{ type: 'api', key: apiKey },
					cfg.projectRoot,
					'global',
				);
				log.success('API key saved!');
			} else {
				await setAuth(
					'openai',
					{
						type: 'oauth',
						refresh: tokens.refresh,
						access: tokens.access,
						expires: tokens.expires,
						accountId: tokens.accountId,
						idToken: tokens.idToken,
					},
					cfg.projectRoot,
					'global',
				);
				log.success(
					`OAuth tokens saved!${tokens.accountId ? ` (Account: ${tokens.accountId.slice(0, 8)}...)` : ''}`,
				);
			}

			log.info(
				'\n💡 You can now use GPT-5.x Codex models with your ChatGPT subscription!',
			);

			if (wantLocal)
				log.warn(
					'Local credential storage is disabled; saved to secure global location.',
				);

			await ensureGlobalConfigDefaults('openai');
			outro('Done');
			return true;
		} catch (error: unknown) {
			oauthResult.close();
			const message =
				error instanceof Error ? error.message : 'Unknown error occurred';
			log.error(`Authentication failed: ${message}`);
			outro('Failed');
			return false;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		log.error(`Failed to initialize authentication: ${message}`);
		outro('Failed');
		return false;
	}
}

async function runAuthLoginAnthropic(
	cfg: Awaited<ReturnType<typeof loadConfig>>,
	wantLocal: boolean,
): Promise<boolean> {
	try {
		const authMethod = (await select({
			message: 'Select authentication method',
			options: [
				{ value: 'max', label: 'Claude Pro/Max (Free with subscription)' },
				{ value: 'console', label: 'Create API Key (Console OAuth)' },
				{ value: 'manual', label: 'Manually enter API Key' },
			],
		})) as 'max' | 'console' | 'manual' | symbol;

		if (isCancel(authMethod)) {
			cancel('Cancelled');
			return false;
		}

		if (authMethod === 'manual') {
			const meta = PROVIDER_LINKS.anthropic;
			log.info(`Open in browser: ${meta.url}`);
			const key = await password({
				message: `Paste ${meta.env} here`,
				validate: (v) =>
					v && String(v).trim().length > 0 ? undefined : 'Required',
			});
			if (isCancel(key)) {
				cancel('Cancelled');
				return false;
			}
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
			outro('Done');
			return true;
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

		if (isCancel(code) || !code) {
			cancel('Cancelled');
			return false;
		}

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
			return true;
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : 'Unknown error occurred';
			log.error(`Authentication failed: ${message}`);
			outro('Failed');
			return false;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		log.error(`Failed to initialize authentication: ${message}`);
		outro('Failed');
		return false;
	}
}

async function runAuthLoginSetu(
	cfg: Awaited<ReturnType<typeof loadConfig>>,
	wantLocal: boolean,
): Promise<boolean> {
	log.info('Setu uses a Solana wallet for authentication.');

	const authMethod = (await select({
		message: 'Select wallet option',
		options: [
			{ value: 'create', label: 'Create new wallet' },
			{ value: 'import', label: 'Import existing wallet' },
		],
	})) as 'create' | 'import' | symbol;

	if (isCancel(authMethod)) {
		cancel('Cancelled');
		return false;
	}

	let privateKeyBase58: string;
	let publicKey: string;

	if (authMethod === 'create') {
		const wallet = generateWallet();
		privateKeyBase58 = wallet.privateKey;
		publicKey = wallet.publicKey;
		log.info('Generated new Solana wallet');
	} else {
		const key = await password({
			message: `Paste ${PROVIDER_LINKS.setu.env} (base58 private key)`,
			validate: (v) =>
				v && String(v).trim().length > 0
					? undefined
					: 'Private key is required',
		});
		if (isCancel(key)) {
			cancel('Cancelled');
			return false;
		}
		try {
			const wallet = importWallet(String(key));
			privateKeyBase58 = wallet.privateKey;
			publicKey = wallet.publicKey;
		} catch {
			log.error(
				'Invalid private key format. Please provide a valid base58 encoded private key.',
			);
			return false;
		}
	}

	await setAuth(
		'setu',
		{ type: 'wallet', secret: privateKeyBase58 },
		cfg.projectRoot,
		'global',
	);
	if (wantLocal)
		log.warn(
			'Local credential storage is disabled; saved to secure global location.',
		);
	await ensureGlobalConfigDefaults('setu');
	log.success('Saved');
	console.log(`  Wallet Public Key: ${colors.cyan(publicKey)}`);
	console.log(
		`  Tip: you can also set ${PROVIDER_LINKS.setu.env} in your environment.`,
	);
	outro('Done');
	return true;
}

async function runAuthLoginCopilot(
	cfg: Awaited<ReturnType<typeof loadConfig>>,
	wantLocal: boolean,
): Promise<boolean> {
	try {
		log.info('Starting GitHub Copilot device flow...');

		const deviceData = await authorizeCopilot();

		log.info(`Opening browser: ${deviceData.verificationUri}`);
		log.info(`Enter code: ${colors.cyan(deviceData.userCode)}\n`);

		const opened = await openCopilotAuthUrl(deviceData.verificationUri);
		if (!opened) {
			log.warn(
				'Could not open browser automatically. Please visit the URL above manually.\n',
			);
		}

		log.info('Waiting for authorization...');
		log.info('(Complete the login in your browser)\n');

		const accessToken = await pollForCopilotToken(
			deviceData.deviceCode,
			deviceData.interval,
		);

		await setAuth(
			'copilot',
			{
				type: 'oauth',
				refresh: accessToken,
				access: accessToken,
				expires: 0,
			},
			cfg.projectRoot,
			'global',
		);

		if (wantLocal)
			log.warn(
				'Local credential storage is disabled; saved to secure global location.',
			);

		await ensureGlobalConfigDefaults('copilot');
		log.success('GitHub Copilot authorized!');
		log.info(
			'You can now use Copilot models (free with GitHub Copilot subscription).',
		);
		outro('Done');
		return true;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		log.error(`Authentication failed: ${message}`);
		outro('Failed');
		return false;
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
			copilot: { enabled: provider === 'copilot' },
			setu: { enabled: provider === 'setu' },
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
