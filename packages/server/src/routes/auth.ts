import type { Hono } from 'hono';
import {
	getAllAuth,
	setAuth,
	removeAuth,
	ensureSetuWallet,
	getSetuWallet,
	importWallet,
	loadConfig,
	catalog,
	getOnboardingComplete,
	setOnboardingComplete,
	authorize,
	exchange,
	authorizeWeb,
	exchangeWeb,
	authorizeOpenAI,
	exchangeOpenAI,
	type ProviderId,
} from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';

const oauthVerifiers = new Map<
	string,
	{ verifier: string; provider: string; createdAt: number; callbackUrl: string }
>();

setInterval(() => {
	const now = Date.now();
	for (const [key, value] of oauthVerifiers.entries()) {
		if (now - value.createdAt > 10 * 60 * 1000) {
			oauthVerifiers.delete(key);
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
			const setuWallet = await getSetuWallet(projectRoot);

			const providers: Record<
				string,
				{
					configured: boolean;
					type?: 'api' | 'oauth' | 'wallet';
					label: string;
					supportsOAuth: boolean;
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
					supportsOAuth: id === 'anthropic' || id === 'openai',
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
				setu: setuWallet
					? {
							configured: true,
							publicKey: setuWallet.publicKey,
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

	app.post('/v1/auth/setu/setup', async (c) => {
		try {
			const projectRoot = process.cwd();
			const existing = await getSetuWallet(projectRoot);
			const wallet = await ensureSetuWallet(projectRoot);

			return c.json({
				success: true,
				publicKey: wallet.publicKey,
				isNew: !existing,
			});
		} catch (error) {
			logger.error('Failed to setup Setu wallet', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/auth/setu/import', async (c) => {
		try {
			const { privateKey } = await c.req.json<{ privateKey: string }>();

			if (!privateKey) {
				return c.json({ error: 'Private key required' }, 400);
			}

			try {
				const wallet = importWallet(privateKey);
				await setAuth(
					'setu',
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
			logger.error('Failed to import Setu wallet', error);
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
			const { mode = 'max' } = await c.req
				.json<{ mode?: string }>()
				.catch(() => ({}));

			let url: string;
			let verifier: string;

			if (provider === 'anthropic') {
				const result = await authorize(mode as 'max' | 'console');
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
				return c.json({ error: 'OAuth not supported for this provider' }, 400);
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

			const { verifier } = oauthVerifiers.get(sessionId)!;
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

			const { verifier, callbackUrl } = oauthVerifiers.get(sessionId)!;
			oauthVerifiers.delete(sessionId);

			if (provider === 'anthropic') {
				const fullCode = fragment ? `${code}#${fragment}` : code;
				const tokens = await exchangeWeb(fullCode!, verifier, callbackUrl);

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
