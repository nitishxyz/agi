import type { Hono } from 'hono';
import {
	fetchOttoRouterBalance,
	getPublicKeyFromPrivate,
	getAuth,
	loadConfig,
} from '@ottocode/sdk';
import { logger } from '@ottocode/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { publish } from '../events/bus.ts';
import {
	resolveTopupMethodSelection,
	rejectTopupSelection,
	getPendingTopup,
	type TopupMethod,
} from '../runtime/topup/manager.ts';

const OTTOROUTER_BASE_URL =
	process.env.OTTOROUTER_BASE_URL || 'https://api.ottorouter.org';

function getOttoRouterBaseUrl(): string {
	return OTTOROUTER_BASE_URL.endsWith('/')
		? OTTOROUTER_BASE_URL.slice(0, -1)
		: OTTOROUTER_BASE_URL;
}

async function getOttoRouterPrivateKey(): Promise<string | null> {
	if (process.env.OTTOROUTER_PRIVATE_KEY) {
		return process.env.OTTOROUTER_PRIVATE_KEY;
	}

	try {
		const cfg = await loadConfig(process.cwd());
		const auth = await getAuth('ottorouter', cfg.projectRoot);
		if (auth?.type === 'wallet' && auth.secret) {
			return auth.secret;
		}
	} catch {}

	return null;
}

function signNonce(nonce: string, privateKeyBytes: Uint8Array): string {
	const data = new TextEncoder().encode(nonce);
	const signature = nacl.sign.detached(data, privateKeyBytes);
	return bs58.encode(signature);
}

function buildWalletHeaders(privateKey: string): Record<string, string> {
	const privateKeyBytes = bs58.decode(privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	const walletAddress = keypair.publicKey.toBase58();
	const nonce = Date.now().toString();
	const signature = signNonce(nonce, privateKeyBytes);
	return {
		'x-wallet-address': walletAddress,
		'x-wallet-nonce': nonce,
		'x-wallet-signature': signature,
	};
}

export function registerOttoRouterRoutes(app: Hono) {
	app.get('/v1/ottorouter/balance', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 401);
			}

			const balance = await fetchOttoRouterBalance({ privateKey });
			if (!balance) {
				return c.json(
					{ error: 'Failed to fetch balance from OttoRouter' },
					502,
				);
			}

			return c.json(balance);
		} catch (error) {
			logger.error('Failed to fetch OttoRouter balance', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/wallet', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json(
					{ error: 'OttoRouter wallet not configured', configured: false },
					200,
				);
			}

			const publicKey = getPublicKeyFromPrivate(privateKey);
			if (!publicKey) {
				return c.json({ error: 'Invalid private key', configured: false }, 200);
			}

			return c.json({
				configured: true,
				publicKey,
			});
		} catch (error) {
			logger.error('Failed to get OttoRouter wallet info', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/usdc-balance', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 401);
			}

			const publicKey = getPublicKeyFromPrivate(privateKey);
			if (!publicKey) {
				return c.json({ error: 'Invalid private key' }, 400);
			}

			const baseUrl = getOttoRouterBaseUrl();
			const response = await fetch(
				`${baseUrl}/v1/wallet/${publicKey}/balances?limit=100&showNative=false&showNfts=false&showZeroBalance=false`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
			);

			if (!response.ok) {
				return c.json({ error: 'Failed to fetch wallet balances' }, 502);
			}

			const data = (await response.json()) as {
				balances: Array<{
					mint: string;
					symbol: string;
					name: string;
					balance: number;
					decimals: number;
					pricePerToken: number | null;
					usdValue: number | null;
				}>;
				totalUsdValue: number;
			};

			const usdcEntry = data.balances.find((b) => b.symbol === 'USDC');

			return c.json({
				walletAddress: publicKey,
				usdcBalance: usdcEntry?.balance ?? 0,
				network: 'mainnet' as const,
			});
		} catch (error) {
			logger.error('Failed to fetch USDC balance', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/topup/polar/estimate', async (c) => {
		try {
			const amount = c.req.query('amount');
			if (!amount) {
				return c.json({ error: 'Missing amount parameter' }, 400);
			}

			const baseUrl = getOttoRouterBaseUrl();
			const response = await fetch(
				`${baseUrl}/v1/topup/polar/estimate?amount=${amount}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
			);

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to get Polar estimate', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/ottorouter/topup/polar', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 401);
			}

			const body = await c.req.json();
			const { amount, successUrl } = body as {
				amount: number;
				successUrl: string;
			};

			if (!amount || typeof amount !== 'number') {
				return c.json({ error: 'Invalid amount' }, 400);
			}

			if (!successUrl || typeof successUrl !== 'string') {
				return c.json({ error: 'Missing successUrl' }, 400);
			}

			const walletHeaders = buildWalletHeaders(privateKey);
			const baseUrl = getOttoRouterBaseUrl();

			const response = await fetch(`${baseUrl}/v1/topup/polar`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...walletHeaders,
				},
				body: JSON.stringify({ amount, successUrl }),
			});

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to create Polar checkout', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/ottorouter/topup/select', async (c) => {
		try {
			const body = await c.req.json();
			const { sessionId, method } = body as {
				sessionId: string;
				method: TopupMethod;
			};

			if (!sessionId || typeof sessionId !== 'string') {
				return c.json({ error: 'Missing sessionId' }, 400);
			}

			if (!method || !['crypto', 'fiat'].includes(method)) {
				return c.json(
					{ error: 'Invalid method, must be "crypto" or "fiat"' },
					400,
				);
			}

			const resolved = resolveTopupMethodSelection(sessionId, method);
			if (!resolved) {
				return c.json(
					{ error: 'No pending topup request found for this session' },
					404,
				);
			}

			publish({
				type: 'ottorouter.topup.method_selected',
				sessionId,
				payload: { method },
			});

			return c.json({ success: true, method });
		} catch (error) {
			logger.error('Failed to select topup method', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/ottorouter/topup/cancel', async (c) => {
		try {
			const body = await c.req.json();
			const { sessionId, reason } = body as {
				sessionId: string;
				reason?: string;
			};

			if (!sessionId || typeof sessionId !== 'string') {
				return c.json({ error: 'Missing sessionId' }, 400);
			}

			const rejected = rejectTopupSelection(
				sessionId,
				reason ?? 'User cancelled',
			);
			if (!rejected) {
				return c.json(
					{ error: 'No pending topup request found for this session' },
					404,
				);
			}

			publish({
				type: 'ottorouter.topup.cancelled',
				sessionId,
				payload: { reason: reason ?? 'User cancelled' },
			});

			return c.json({ success: true });
		} catch (error) {
			logger.error('Failed to cancel topup', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/topup/pending', async (c) => {
		try {
			const sessionId = c.req.query('sessionId');
			if (!sessionId) {
				return c.json({ error: 'Missing sessionId parameter' }, 400);
			}

			const pending = getPendingTopup(sessionId);
			if (!pending) {
				return c.json({ hasPending: false });
			}

			return c.json({
				hasPending: true,
				sessionId: pending.sessionId,
				messageId: pending.messageId,
				amountUsd: pending.amountUsd,
				currentBalance: pending.currentBalance,
				createdAt: pending.createdAt,
			});
		} catch (error) {
			logger.error('Failed to get pending topup', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/topup/polar/status', async (c) => {
		try {
			const checkoutId = c.req.query('checkoutId');
			if (!checkoutId) {
				return c.json({ error: 'Missing checkoutId parameter' }, 400);
			}

			const baseUrl = getOttoRouterBaseUrl();
			const response = await fetch(
				`${baseUrl}/v1/topup/polar/status?checkoutId=${checkoutId}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
			);

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to check Polar status', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/ottorouter/topup/razorpay/estimate', async (c) => {
		try {
			const amount = c.req.query('amount');
			if (!amount) {
				return c.json({ error: 'Missing amount parameter' }, 400);
			}

			const baseUrl = getOttoRouterBaseUrl();
			const response = await fetch(
				`${baseUrl}/v1/topup/razorpay/estimate?amount=${amount}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
			);

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to get Razorpay estimate', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/ottorouter/topup/razorpay', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 401);
			}

			const body = await c.req.json();
			const { amount } = body as { amount: number };

			if (!amount || typeof amount !== 'number') {
				return c.json({ error: 'Invalid amount' }, 400);
			}

			const walletHeaders = buildWalletHeaders(privateKey);
			const baseUrl = getOttoRouterBaseUrl();

			const response = await fetch(`${baseUrl}/v1/topup/razorpay`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...walletHeaders,
				},
				body: JSON.stringify({ amount }),
			});

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to create Razorpay order', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.post('/v1/ottorouter/topup/razorpay/verify', async (c) => {
		try {
			const privateKey = await getOttoRouterPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'OttoRouter wallet not configured' }, 401);
			}

			const body = await c.req.json();
			const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
				body as {
					razorpay_order_id: string;
					razorpay_payment_id: string;
					razorpay_signature: string;
				};

			if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
				return c.json({ error: 'Missing payment details' }, 400);
			}

			const walletHeaders = buildWalletHeaders(privateKey);
			const baseUrl = getOttoRouterBaseUrl();

			const response = await fetch(`${baseUrl}/v1/topup/razorpay/verify`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...walletHeaders,
				},
				body: JSON.stringify({
					razorpay_order_id,
					razorpay_payment_id,
					razorpay_signature,
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				return c.json(data, response.status as 400 | 500);
			}

			return c.json(data);
		} catch (error) {
			logger.error('Failed to verify Razorpay payment', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});
}
