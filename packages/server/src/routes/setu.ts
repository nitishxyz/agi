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
}
