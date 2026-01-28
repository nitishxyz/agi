import type { Hono } from 'hono';
import {
	fetchSetuBalance,
	getPublicKeyFromPrivate,
	getAuth,
	loadConfig,
	fetchSolanaUsdcBalance,
} from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';
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

const SETU_BASE_URL = process.env.SETU_BASE_URL || 'https://setu.agi.nitish.sh';

function getSetuBaseUrl(): string {
	return SETU_BASE_URL.endsWith('/')
		? SETU_BASE_URL.slice(0, -1)
		: SETU_BASE_URL;
}

async function getSetuPrivateKey(): Promise<string | null> {
	if (process.env.SETU_PRIVATE_KEY) {
		return process.env.SETU_PRIVATE_KEY;
	}

	try {
		const cfg = await loadConfig(process.cwd());
		const auth = await getAuth('setu', cfg.projectRoot);
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

export function registerSetuRoutes(app: Hono) {
	app.get('/v1/setu/balance', async (c) => {
		try {
			const privateKey = await getSetuPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'Setu wallet not configured' }, 401);
			}

			const balance = await fetchSetuBalance({ privateKey });
			if (!balance) {
				return c.json({ error: 'Failed to fetch balance from Setu' }, 502);
			}

			return c.json(balance);
		} catch (error) {
			logger.error('Failed to fetch Setu balance', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/setu/wallet', async (c) => {
		try {
			const privateKey = await getSetuPrivateKey();
			if (!privateKey) {
				return c.json(
					{ error: 'Setu wallet not configured', configured: false },
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
			logger.error('Failed to get Setu wallet info', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/setu/usdc-balance', async (c) => {
		try {
			const privateKey = await getSetuPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'Setu wallet not configured' }, 401);
			}

			const network =
				(c.req.query('network') as 'mainnet' | 'devnet') || 'mainnet';

			const balance = await fetchSolanaUsdcBalance({ privateKey }, network);
			if (!balance) {
				return c.json(
					{ error: 'Failed to fetch USDC balance from Solana' },
					502,
				);
			}

			return c.json(balance);
		} catch (error) {
			logger.error('Failed to fetch USDC balance', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/setu/topup/polar/estimate', async (c) => {
		try {
			const amount = c.req.query('amount');
			if (!amount) {
				return c.json({ error: 'Missing amount parameter' }, 400);
			}

			const baseUrl = getSetuBaseUrl();
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

	app.post('/v1/setu/topup/polar', async (c) => {
		try {
			const privateKey = await getSetuPrivateKey();
			if (!privateKey) {
				return c.json({ error: 'Setu wallet not configured' }, 401);
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
			const baseUrl = getSetuBaseUrl();

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

	app.post('/v1/setu/topup/select', async (c) => {
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
				type: 'setu.topup.method_selected',
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

	app.post('/v1/setu/topup/cancel', async (c) => {
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
				type: 'setu.topup.cancelled',
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

	app.get('/v1/setu/topup/pending', async (c) => {
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

	app.get('/v1/setu/topup/polar/status', async (c) => {
		try {
			const checkoutId = c.req.query('checkoutId');
			if (!checkoutId) {
				return c.json({ error: 'Missing checkoutId parameter' }, 400);
			}

			const baseUrl = getSetuBaseUrl();
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
}
