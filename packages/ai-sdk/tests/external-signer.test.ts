import { describe, test, expect } from 'bun:test';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { createWalletContext } from '../src/auth.ts';
import type { SetuAuth } from '../src/types.ts';

describe('createWalletContext', () => {
	const keypair = Keypair.generate();
	const privateKey = bs58.encode(keypair.secretKey);

	test('private key mode creates keypair and privateKeyBytes', () => {
		const auth: SetuAuth = { privateKey };
		const ctx = createWalletContext(auth);

		expect(ctx.walletAddress).toBe(keypair.publicKey.toBase58());
		expect(ctx.keypair).toBeDefined();
		expect(ctx.privateKeyBytes).toBeDefined();
		expect(ctx.transactionSigner).toBeUndefined();

		const headers = ctx.buildHeaders() as Record<string, string>;
		expect(headers['x-wallet-address']).toBe(keypair.publicKey.toBase58());
		expect(headers['x-wallet-nonce']).toBeDefined();
		expect(headers['x-wallet-signature']).toBeDefined();
	});

	test('external signer mode uses signNonce', async () => {
		const walletAddress = keypair.publicKey.toBase58();
		const auth: SetuAuth = {
			signer: {
				walletAddress,
				signNonce: (nonce: string) => {
					const data = new TextEncoder().encode(nonce);
					const sig = nacl.sign.detached(data, keypair.secretKey);
					return bs58.encode(sig);
				},
			},
		};
		const ctx = createWalletContext(auth);

		expect(ctx.walletAddress).toBe(walletAddress);
		expect(ctx.keypair).toBeUndefined();
		expect(ctx.privateKeyBytes).toBeUndefined();
		expect(ctx.transactionSigner).toBeUndefined();

		const headers = await ctx.buildHeaders();
		expect(headers['x-wallet-address']).toBe(walletAddress);
		expect(headers['x-wallet-nonce']).toBeDefined();
		expect(headers['x-wallet-signature']).toBeDefined();
	});

	test('external signer with signTransaction passes through', () => {
		const walletAddress = keypair.publicKey.toBase58();
		const auth: SetuAuth = {
			signer: {
				walletAddress,
				signNonce: () => 'test-sig',
				signTransaction: keypair,
			},
		};
		const ctx = createWalletContext(auth);

		expect(ctx.transactionSigner).toBe(keypair);
	});

	test('external signer with async signNonce', async () => {
		const walletAddress = keypair.publicKey.toBase58();
		const auth: SetuAuth = {
			signer: {
				walletAddress,
				signNonce: async (nonce: string) => {
					await new Promise((r) => setTimeout(r, 1));
					const data = new TextEncoder().encode(nonce);
					const sig = nacl.sign.detached(data, keypair.secretKey);
					return bs58.encode(sig);
				},
			},
		};
		const ctx = createWalletContext(auth);
		const headers = await ctx.buildHeaders();

		expect(headers['x-wallet-signature']).toBeDefined();
		expect(headers['x-wallet-signature'].length).toBeGreaterThan(10);
	});

	test('throws without privateKey or signer', () => {
		expect(() => createWalletContext({})).toThrow(
			'Setu: either privateKey or signer is required.',
		);
	});

	test('private key signature is valid', () => {
		const ctx = createWalletContext({ privateKey });
		const headers = ctx.buildHeaders() as Record<string, string>;

		const nonce = headers['x-wallet-nonce'];
		const sig = bs58.decode(headers['x-wallet-signature']);
		const data = new TextEncoder().encode(nonce);
		const valid = nacl.sign.detached.verify(
			data,
			sig,
			keypair.publicKey.toBytes(),
		);
		expect(valid).toBe(true);
	});

	test('external signer signature is valid', async () => {
		const walletAddress = keypair.publicKey.toBase58();
		const ctx = createWalletContext({
			signer: {
				walletAddress,
				signNonce: (nonce: string) => {
					const data = new TextEncoder().encode(nonce);
					const sig = nacl.sign.detached(data, keypair.secretKey);
					return bs58.encode(sig);
				},
			},
		});
		const headers = await ctx.buildHeaders();

		const nonce = headers['x-wallet-nonce'];
		const sig = bs58.decode(headers['x-wallet-signature']);
		const data = new TextEncoder().encode(nonce);
		const valid = nacl.sign.detached.verify(
			data,
			sig,
			keypair.publicKey.toBytes(),
		);
		expect(valid).toBe(true);
	});
});
