import type { MiddlewareHandler } from 'hono';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const walletAuth: MiddlewareHandler = async (c, next) => {
	const walletAddress = c.req.header('x-wallet-address');
	const signature = c.req.header('x-wallet-signature');
	const nonce = c.req.header('x-wallet-nonce');

	if (!walletAddress || !signature || !nonce) {
		return c.json({ error: 'Missing authentication headers' }, 401);
	}

	try {
		const publicKey = new PublicKey(walletAddress).toBytes();
		const signatureBytes = bs58.decode(signature);
		const messageBytes = new TextEncoder().encode(nonce);

		const verified = nacl.sign.detached.verify(
			messageBytes,
			signatureBytes,
			publicKey,
		);

		if (!verified) {
			return c.json({ error: 'Invalid signature' }, 401);
		}

		const nonceTime = parseInt(nonce, 10);
		const now = Date.now();
		if (Math.abs(now - nonceTime) > 60000) {
			return c.json({ error: 'Nonce expired' }, 401);
		}

		c.set('walletAddress', walletAddress);
		await next();
	} catch (error) {
		return c.json(
			{
				error: 'Authentication failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			401,
		);
	}
};
