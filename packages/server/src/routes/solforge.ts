import type { Hono } from 'hono';
import {
	fetchSolforgeBalance,
	getPublicKeyFromPrivate,
	getAuth,
	loadConfig,
	fetchSolanaUsdcBalance,
} from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';

async function getSolforgePrivateKey(): Promise<string | null> {
	if (process.env.SOLFORGE_PRIVATE_KEY) {
		return process.env.SOLFORGE_PRIVATE_KEY;
	}

	try {
		const cfg = await loadConfig(process.cwd());
		const auth = await getAuth('solforge', cfg.projectRoot);
		if (auth?.type === 'wallet' && auth.secret) {
			return auth.secret;
		}
	} catch {}

	return null;
}

export function registerSolforgeRoutes(app: Hono) {
	app.get('/v1/solforge/balance', async (c) => {
		try {
			const privateKey = await getSolforgePrivateKey();
			if (!privateKey) {
				return c.json({ error: 'Solforge wallet not configured' }, 401);
			}

			const balance = await fetchSolforgeBalance({ privateKey });
			if (!balance) {
				return c.json({ error: 'Failed to fetch balance from Solforge' }, 502);
			}

			return c.json(balance);
		} catch (error) {
			logger.error('Failed to fetch Solforge balance', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/solforge/wallet', async (c) => {
		try {
			const privateKey = await getSolforgePrivateKey();
			if (!privateKey) {
				return c.json(
					{ error: 'Solforge wallet not configured', configured: false },
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
			logger.error('Failed to get Solforge wallet info', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, errorResponse.error.status || 500);
		}
	});

	app.get('/v1/solforge/usdc-balance', async (c) => {
		try {
			const privateKey = await getSolforgePrivateKey();
			if (!privateKey) {
				return c.json(
					{ error: 'Solforge wallet not configured' },
					401,
				);
			}

			const network = (c.req.query('network') as 'mainnet' | 'devnet') || 'mainnet';

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
