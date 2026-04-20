import type { Hono } from 'hono';
import {
	getAllAuth,
	getAuth,
	setAuth,
	removeAuth,
	ensureOttoRouterWallet,
	getOttoRouterWallet,
	importWallet,
	loadConfig,
	catalog,
	readEnvKey,
	getOnboardingComplete,
	setOnboardingComplete,
	authorize,
	exchange,
	authorizeWeb,
	exchangeWeb,
	authorizeOpenAI,
	exchangeOpenAI,
	authorizeCopilot,
	pollForCopilotTokenOnce,
	type ProviderId,
} from '@ottocode/sdk';
import { execFileSync, spawnSync } from 'node:child_process';
import { logger } from '@ottocode/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';

const oauthVerifiers = new Map<
	string,
	{ verifier: string; provider: string; createdAt: number; callbackUrl: string }
>();

const copilotDeviceSessions = new Map<
	string,
	{ deviceCode: string; interval: number; provider: string; createdAt: number }
>();

const COPILOT_MODELS_URL = 'https://api.githubcopilot.com/models';
const GH_CAPABILITY_CACHE_TTL_MS = 60 * 1000;

let ghCapabilityCache: {
	expiresAt: number;
	value: { available: boolean; authenticated: boolean; reason?: string };
} = {
	expiresAt: 0,
	value: {
		available: false,
		authenticated: false,
		reason: 'Not checked yet',
	},
};

function getGhImportCapability() {
	if (ghCapabilityCache.expiresAt > Date.now()) return ghCapabilityCache.value;

	const version = spawnSync('gh', ['--version'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (version.status !== 0) {
		ghCapabilityCache = {
			expiresAt: Date.now() + GH_CAPABILITY_CACHE_TTL_MS,
			value: {
				available: false,
				authenticated: false,
				reason: 'GitHub CLI (gh) is not installed',
			},
		};
		return ghCapabilityCache.value;
	}

	const authStatus = spawnSync('gh', ['auth', 'status', '-h', 'github.com'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (authStatus.status !== 0) {
		ghCapabilityCache = {
			expiresAt: Date.now() + GH_CAPABILITY_CACHE_TTL_MS,
			value: {
				available: true,
				authenticated: false,
				reason: 'Run `gh auth login` first',
			},
		};
		return ghCapabilityCache.value;
	}

	ghCapabilityCache = {
		expiresAt: Date.now() + GH_CAPABILITY_CACHE_TTL_MS,
		value: {
			available: true,
			authenticated: true,
		},
	};
	return ghCapabilityCache.value;
}

function parseErrorMessageFromBody(text: string): string | undefined {
	if (!text) return undefined;
	try {
		const parsed = JSON.parse(text) as {
			message?: string;
			error?: { message?: string };
		};
		return parsed.error?.message ?? parsed.message;
	} catch {
		return undefined;
	}
}

async function fetchCopilotModels(token: string): Promise<
	| {
			ok: true;
			models: Set<string>;
	  }
	| {
			ok: false;
			status: number;
			message: string;
	  }
> {
	try {
		const response = await fetch(COPILOT_MODELS_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Openai-Intent': 'conversation-edits',
				'User-Agent': 'ottocode',
			},
		});
		const text = await response.text();
		if (!response.ok) {
			return {
				ok: false,
				status: response.status,
				message:
					parseErrorMessageFromBody(text) ||
					`Copilot models endpoint returned ${response.status}`,
			};
		}

		const payload = JSON.parse(text) as {
			data?: Array<{ id?: string }>;
		};
		const models = new Set(
			(payload.data ?? [])
				.map((item) => item.id)
				.filter((id): id is string => Boolean(id)),
		);
		return { ok: true, models };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Failed to fetch Copilot models';
		return { ok: false, status: 0, message };
	}
}

async function detectOAuthOrgRestriction(token: string): Promise<{
	restricted: boolean;
	org?: string;
	message?: string;
}> {
	try {
		const orgsResponse = await fetch('https://api.github.com/user/orgs', {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'ottocode',
				Accept: 'application/vnd.github+json',
			},
		});
		if (!orgsResponse.ok) {
			return { restricted: false };
		}

		const orgs = (await orgsResponse.json()) as Array<{ login?: string }>;
		for (const org of orgs) {
			if (!org.login) continue;
			const membershipResponse = await fetch(
				`https://api.github.com/user/memberships/orgs/${org.login}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						'User-Agent': 'ottocode',
						Accept: 'application/vnd.github+json',
					},
				},
			);
			if (membershipResponse.status !== 403) continue;

			const bodyText = await membershipResponse.text();
			const message = parseErrorMessageFromBody(bodyText) || bodyText;
			if (message.includes('enabled OAuth App access restrictions')) {
				return {
					restricted: true,
					org: org.login,
					message,
				};
			}
		}
	} catch {}

	return { restricted: false };
}

setInterval(() => {
	const now = Date.now();
	for (const [key, value] of oauthVerifiers.entries()) {
		if (now - value.createdAt > 10 * 60 * 1000) {
			oauthVerifiers.delete(key);
		}
	}
	for (const [key, value] of copilotDeviceSessions.entries()) {
		if (now - value.createdAt > 10 * 60 * 1000) {
			copilotDeviceSessions.delete(key);
		}
	}
}, 60 * 1000);

export function registerAuthRoutes(app: Hono) {
	app.get('/v1/auth/status', async (c) => {
		try {
			const projectRoot = process.cwd();
			const auth = await getAllAuth(projectRoot);
			const cfg = await loadConfig(projectRoot);
			const onboardingComplete = await getOnboardingComplete(projectRoot);
			const ottorouterWallet = await getOttoRouterWallet(projectRoot);
			const ghImportCapability = getGhImportCapability();

			const providers: Record<
				string,
				{
					configured: boolean;
					type?: 'api' | 'oauth' | 'wallet';
					label: string;
					supportsOAuth: boolean;
					supportsToken?: boolean;
					supportsGhImport?: boolean;
					modelCount: number;
					costRange?: { min: number; max: number };
				}
			> = {};

			for (const [id, entry] of Object.entries(catalog)) {
				const providerAuth = auth[id as ProviderId];
				const models = entry.models || [];
				const costs = models
					.map((m) => m.cost?.input)
					.filter((c): c is number => c !== undefined);

				providers[id] = {
					configured: !!providerAuth,
					type: providerAuth?.type,
					label: entry.label || id,
					supportsOAuth:
						id === 'anthropic' || id === 'openai' || id === 'copilot',
					supportsToken: id === 'copilot',
					supportsGhImport:
						id === 'copilot' ? ghImportCapability.available : false,
					modelCount: models.length,
					costRange:
						costs.length > 0
							? {
									min: Math.min(...costs),
									max: Math.max(...costs),
								}
							: undefined,
				};
			}

			return c.json({
				onboardingComplete,
				ottorouter: ottorouterWallet
					? {
							configured: true,
							publicKey: ottorouterWallet.publicKey,
						}
					: {
							configured: false,
						},
				providers,
				defaults: cfg.defaults,
			});
		} catch (error) {
			logger.error('Failed to get auth status', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/auth/ottorouter/setup', async (c) => {
		try {
			const projectRoot = process.cwd();
			const existing = await getOttoRouterWallet(projectRoot);
			const wallet = await ensureOttoRouterWallet(projectRoot);

			return c.json({
				success: true,
				publicKey: wallet.publicKey,
				isNew: !existing,
			});
		} catch (error) {
			logger.error('Failed to setup OttoRouter wallet', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/auth/ottorouter/import', async (c) => {
		try {
			const { privateKey } = await c.req.json<{ privateKey: string }>();

			if (!privateKey) {
				return c.json({ error: 'Private key required' }, 400);
			}

			try {
				const wallet = importWallet(privateKey);
				await setAuth(
					'ottorouter',
					{ type: 'wallet', secret: privateKey },
					undefined,
					'global',
				);

				return c.json({
					success: true,
					publicKey: wallet.publicKey,
				});
			} catch {
				return c.json({ error: 'Invalid private key format' }, 400);
			}
		} catch (error) {
			logger.error('Failed to import OttoRouter wallet', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/auth/ottorouter/export', async (c) => {
		try {
			const projectRoot = process.cwd();
			const wallet = await getOttoRouterWallet(projectRoot);

			if (!wallet) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 404);
			}

			return c.json({
				success: true,
				publicKey: wallet.publicKey,
				privateKey: wallet.privateKey,
			});
		} catch (error) {
			logger.error('Failed to export OttoRouter wallet', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/auth/:provider', async (c) => {
		try {
			const provider = c.req.param('provider') as ProviderId;
			const { apiKey } = await c.req.json<{ apiKey: string }>();

			if (!catalog[provider]) {
				return c.json({ error: 'Unknown provider' }, 400);
			}

			if (!apiKey) {
				return c.json({ error: 'API key required' }, 400);
			}

			await setAuth(
				provider,
				{ type: 'api', key: apiKey },
				undefined,
				'global',
			);

			return c.json({ success: true, provider });
		} catch (error) {
			logger.error('Failed to add provider', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/auth/:provider/oauth/url', async (c) => {
		try {
			const provider = c.req.param('provider');
			const body = await c.req.json<{ mode?: string }>().catch(() => undefined);
			const mode: 'max' | 'console' =
				body?.mode === 'console' ? 'console' : 'max';

			let url: string;
			let verifier: string;

			if (provider === 'anthropic') {
				const result = await authorize(mode);
				url = result.url;
				verifier = result.verifier;
			} else if (provider === 'openai') {
				return c.json(
					{
						error:
							'OpenAI OAuth requires localhost callback. Use the redirect flow instead.',
					},
					400,
				);
			} else {
				return c.json(
					{
						error: `OAuth not supported for provider: ${provider}. Copilot uses device flow — use /v1/auth/copilot/device/start instead.`,
					},
					400,
				);
			}

			const sessionId = crypto.randomUUID();
			oauthVerifiers.set(sessionId, {
				verifier,
				provider,
				createdAt: Date.now(),
				callbackUrl: '',
			});

			return c.json({ url, sessionId, provider });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'OAuth initialization failed';
			logger.error('OAuth URL generation failed', error);
			return c.json({ error: message }, 500);
		}
	});

	app.post('/v1/auth/:provider/oauth/exchange', async (c) => {
		try {
			const provider = c.req.param('provider');
			const { code, sessionId } = await c.req.json<{
				code: string;
				sessionId: string;
			}>();

			if (!code || !sessionId) {
				return c.json({ error: 'Code and sessionId required' }, 400);
			}

			if (!oauthVerifiers.has(sessionId)) {
				return c.json({ error: 'Session expired or invalid' }, 400);
			}

			const verifierEntry = oauthVerifiers.get(sessionId);
			if (!verifierEntry) {
				return c.json({ error: 'Session expired or invalid' }, 400);
			}
			const { verifier } = verifierEntry;
			oauthVerifiers.delete(sessionId);

			if (provider === 'anthropic') {
				const tokens = await exchange(code, verifier);
				await setAuth(
					'anthropic',
					{
						type: 'oauth',
						refresh: tokens.refresh,
						access: tokens.access,
						expires: tokens.expires,
					},
					undefined,
					'global',
				);
			} else if (provider === 'openai') {
				return c.json({ error: 'Use redirect flow for OpenAI' }, 400);
			} else {
				return c.json({ error: 'Unknown provider' }, 400);
			}

			return c.json({ success: true, provider });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Token exchange failed';
			logger.error('OAuth exchange failed', error);
			return c.json({ error: message }, 500);
		}
	});

	app.get('/v1/auth/:provider/oauth/start', async (c) => {
		try {
			const provider = c.req.param('provider');
			const mode = c.req.query('mode') || 'max';

			let url: string;
			let verifier: string;
			let callbackUrl = '';

			if (provider === 'anthropic') {
				const host = c.req.header('host') || 'localhost:3000';
				const protocol = c.req.header('x-forwarded-proto') || 'http';
				callbackUrl = `${protocol}://${host}/v1/auth/${provider}/oauth/callback`;
				const result = authorizeWeb(mode as 'max' | 'console', callbackUrl);
				url = result.url;
				verifier = result.verifier;
			} else if (provider === 'openai') {
				const result = await authorizeOpenAI();
				url = result.url;
				verifier = result.verifier;
				callbackUrl = 'localhost';
				result
					.waitForCallback()
					.then(async (code) => {
						const tokens = await exchangeOpenAI(code, verifier);
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
							undefined,
							'global',
						);
						result.close();
					})
					.catch(() => {
						result.close();
					});
			} else {
				return c.json({ error: 'OAuth not supported for this provider' }, 400);
			}

			const sessionId = crypto.randomUUID();
			oauthVerifiers.set(sessionId, {
				verifier,
				provider,
				createdAt: Date.now(),
				callbackUrl,
			});

			c.header(
				'Set-Cookie',
				`oauth_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
			);

			return c.redirect(url);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'OAuth initialization failed';
			logger.error('OAuth start failed', error);
			return c.json({ error: message }, 500);
		}
	});

	app.get('/v1/auth/:provider/oauth/callback', async (c) => {
		try {
			const provider = c.req.param('provider');
			const code = c.req.query('code');
			const fragment = c.req.query('fragment');

			const cookies = c.req.header('Cookie') || '';
			const sessionMatch = cookies.match(/oauth_session=([^;]+)/);
			const sessionId = sessionMatch?.[1];

			if (!sessionId || !oauthVerifiers.has(sessionId)) {
				return c.html(
					'<html><body><h1>Session expired</h1><p>Please close this window and try again.</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
				);
			}

			const callbackEntry = oauthVerifiers.get(sessionId);
			if (!callbackEntry) {
				return c.html(
					'<html><body><h1>Session expired</h1><p>Please close this window and try again.</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
				);
			}
			const { verifier, callbackUrl } = callbackEntry;
			oauthVerifiers.delete(sessionId);

			if (provider === 'anthropic') {
				const fullCode = fragment ? `${code}#${fragment}` : (code ?? '');
				const tokens = await exchangeWeb(fullCode, verifier, callbackUrl);

				await setAuth(
					'anthropic',
					{
						type: 'oauth',
						refresh: tokens.refresh,
						access: tokens.access,
						expires: tokens.expires,
					},
					undefined,
					'global',
				);
			} else if (provider === 'openai') {
				return c.html(
					'<html><body><h1>OpenAI uses localhost callback</h1><p>This route is not used for OpenAI. Please close this window.</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
				);
			}

			return c.html(`
				<html>
					<head>
						<title>Connected!</title>
						<style>
							body {
								font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
								display: flex;
								justify-content: center;
								align-items: center;
								height: 100vh;
								margin: 0;
								background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
								color: white;
							}
							.container {
								text-align: center;
								padding: 2rem;
								background: rgba(255,255,255,0.1);
								border-radius: 16px;
								backdrop-filter: blur(10px);
							}
							.checkmark {
								font-size: 4rem;
								margin-bottom: 1rem;
							}
							h1 { margin: 0 0 0.5rem 0; }
							p { margin: 0; opacity: 0.9; }
						</style>
					</head>
					<body>
						<div class="container">
							<div class="checkmark">✓</div>
							<h1>Connected!</h1>
							<p>You can close this window.</p>
						</div>
						<script>
							if (window.opener) {
								window.opener.postMessage({ type: 'oauth-success', provider: '${provider}' }, '*');
							}
							setTimeout(() => window.close(), 1500);
						</script>
					</body>
				</html>
			`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Authentication failed';
			logger.error('OAuth callback failed', error);
			return c.html(`
				<html>
					<head>
						<title>Error</title>
						<style>
							body {
								font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
								display: flex;
								justify-content: center;
								align-items: center;
								height: 100vh;
								margin: 0;
								background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
								color: white;
							}
							.container {
								text-align: center;
								padding: 2rem;
								background: rgba(255,255,255,0.1);
								border-radius: 16px;
								backdrop-filter: blur(10px);
							}
							.icon { font-size: 4rem; margin-bottom: 1rem; }
							h1 { margin: 0 0 0.5rem 0; }
							p { margin: 0; opacity: 0.9; }
						</style>
					</head>
					<body>
						<div class="container">
							<div class="icon">✗</div>
							<h1>Error</h1>
							<p>${message}</p>
						</div>
						<script>
							if (window.opener) {
								window.opener.postMessage({ type: 'oauth-error', provider: '${c.req.param('provider')}', error: '${message}' }, '*');
							}
							setTimeout(() => window.close(), 3000);
						</script>
					</body>
				</html>
			`);
		}
	});

	app.post('/v1/auth/copilot/device/start', async (c) => {
		try {
			const deviceData = await authorizeCopilot();
			const sessionId = crypto.randomUUID();
			copilotDeviceSessions.set(sessionId, {
				deviceCode: deviceData.deviceCode,
				interval: deviceData.interval,
				provider: 'copilot',
				createdAt: Date.now(),
			});
			return c.json({
				sessionId,
				userCode: deviceData.userCode,
				verificationUri: deviceData.verificationUri,
				interval: deviceData.interval,
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to start Copilot device flow';
			logger.error('Copilot device flow start failed', error);
			return c.json({ error: message }, 500);
		}
	});

	app.post('/v1/auth/copilot/device/poll', async (c) => {
		try {
			const { sessionId } = await c.req.json<{ sessionId: string }>();
			if (!sessionId || !copilotDeviceSessions.has(sessionId)) {
				return c.json({ error: 'Session expired or invalid' }, 400);
			}
			const session = copilotDeviceSessions.get(sessionId);
			if (!session) {
				return c.json({ error: 'Session expired or invalid' }, 400);
			}
			const result = await pollForCopilotTokenOnce(session.deviceCode);
			if (result.status === 'complete') {
				copilotDeviceSessions.delete(sessionId);
				await setAuth(
					'copilot',
					{
						type: 'oauth',
						refresh: result.accessToken,
						access: result.accessToken,
						expires: 0,
					},
					undefined,
					'global',
				);
				return c.json({ status: 'complete' });
			}
			if (result.status === 'pending') {
				return c.json({ status: 'pending' });
			}
			if (result.status === 'error') {
				copilotDeviceSessions.delete(sessionId);
				return c.json({ status: 'error', error: result.error });
			}
			return c.json({ status: 'pending' });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Poll failed';
			logger.error('Copilot device poll failed', error);
			return c.json({ error: message }, 500);
		}
	});

	app.get('/v1/auth/copilot/methods', async (c) => {
		const ghImport = getGhImportCapability();
		return c.json({
			oauth: true,
			token: true,
			ghImport,
		});
	});

	app.post('/v1/auth/copilot/token', async (c) => {
		try {
			const { token } = await c.req.json<{ token: string }>();
			const sanitized = token?.trim();
			if (!sanitized) {
				return c.json({ error: 'Copilot token is required' }, 400);
			}

			const modelsResult = await fetchCopilotModels(sanitized);
			if (!modelsResult.ok) {
				return c.json(
					{
						error: `Invalid Copilot token: ${modelsResult.message}`,
					},
					400,
				);
			}

			await setAuth(
				'copilot',
				{
					type: 'oauth',
					refresh: sanitized,
					access: sanitized,
					expires: 0,
				},
				undefined,
				'global',
			);

			const models = Array.from(modelsResult.models).sort();
			return c.json({
				success: true,
				provider: 'copilot',
				source: 'token',
				modelCount: models.length,
				hasGpt52Codex: modelsResult.models.has('gpt-5.2-codex'),
				sampleModels: models.slice(0, 25),
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to save Copilot token';
			logger.error('Failed to save Copilot token', error);
			return c.json({ error: message }, 500);
		}
	});

	app.post('/v1/auth/copilot/gh/import', async (c) => {
		try {
			const ghImport = getGhImportCapability();
			if (!ghImport.available) {
				return c.json(
					{
						error: ghImport.reason || 'GitHub CLI is not available',
					},
					400,
				);
			}
			if (!ghImport.authenticated) {
				return c.json(
					{
						error: ghImport.reason || 'GitHub CLI is not authenticated',
					},
					400,
				);
			}

			const ghToken = execFileSync('gh', ['auth', 'token'], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			}).trim();
			if (!ghToken) {
				return c.json({ error: 'GitHub CLI returned an empty token' }, 400);
			}

			const modelsResult = await fetchCopilotModels(ghToken);
			if (!modelsResult.ok) {
				return c.json(
					{
						error: `Imported gh token is not valid for Copilot: ${modelsResult.message}`,
					},
					400,
				);
			}

			await setAuth(
				'copilot',
				{
					type: 'oauth',
					refresh: ghToken,
					access: ghToken,
					expires: 0,
				},
				undefined,
				'global',
			);

			const models = Array.from(modelsResult.models).sort();
			return c.json({
				success: true,
				provider: 'copilot',
				source: 'gh',
				modelCount: models.length,
				hasGpt52Codex: modelsResult.models.has('gpt-5.2-codex'),
				sampleModels: models.slice(0, 25),
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to import GitHub CLI token';
			logger.error('Failed to import Copilot token from GitHub CLI', error);
			return c.json({ error: message }, 500);
		}
	});

	app.get('/v1/auth/copilot/diagnostics', async (c) => {
		try {
			const projectRoot = process.cwd();
			const entries: Array<{
				source: 'env' | 'stored';
				configured: boolean;
				modelCount?: number;
				hasGpt52Codex?: boolean;
				sampleModels?: string[];
				restrictedByOrgPolicy?: boolean;
				restrictedOrg?: string;
				restrictionMessage?: string;
				error?: string;
			}> = [];

			const envToken = readEnvKey('copilot');
			if (envToken) {
				const modelsResult = await fetchCopilotModels(envToken);
				if (modelsResult.ok) {
					const models = Array.from(modelsResult.models).sort();
					entries.push({
						source: 'env',
						configured: true,
						modelCount: models.length,
						hasGpt52Codex: modelsResult.models.has('gpt-5.2-codex'),
						sampleModels: models.slice(0, 25),
					});
				} else {
					entries.push({
						source: 'env',
						configured: true,
						error: modelsResult.message,
					});
				}
			} else {
				entries.push({ source: 'env', configured: false });
			}

			const storedAuth = await getAuth('copilot', projectRoot);
			if (storedAuth?.type === 'oauth') {
				const modelsResult = await fetchCopilotModels(storedAuth.refresh);
				const restriction = await detectOAuthOrgRestriction(storedAuth.refresh);
				if (modelsResult.ok) {
					const models = Array.from(modelsResult.models).sort();
					entries.push({
						source: 'stored',
						configured: true,
						modelCount: models.length,
						hasGpt52Codex: modelsResult.models.has('gpt-5.2-codex'),
						sampleModels: models.slice(0, 25),
						restrictedByOrgPolicy: restriction.restricted,
						restrictedOrg: restriction.org,
						restrictionMessage: restriction.message,
					});
				} else {
					entries.push({
						source: 'stored',
						configured: true,
						error: modelsResult.message,
						restrictedByOrgPolicy: restriction.restricted,
						restrictedOrg: restriction.org,
						restrictionMessage: restriction.message,
					});
				}
			} else {
				entries.push({ source: 'stored', configured: false });
			}

			return c.json({
				tokenSources: entries,
				methods: {
					oauth: true,
					token: true,
					ghImport: getGhImportCapability(),
				},
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to inspect Copilot';
			logger.error('Failed to build Copilot diagnostics', error);
			return c.json({ error: message }, 500);
		}
	});

	app.post('/v1/auth/onboarding/complete', async (c) => {
		try {
			await setOnboardingComplete();
			return c.json({ success: true });
		} catch (error) {
			logger.error('Failed to complete onboarding', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.delete('/v1/auth/:provider', async (c) => {
		try {
			const provider = c.req.param('provider') as ProviderId;

			if (!catalog[provider]) {
				return c.json({ error: 'Unknown provider' }, 400);
			}

			await removeAuth(provider, undefined, 'global');

			return c.json({ success: true, provider });
		} catch (error) {
			logger.error('Failed to remove provider', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
