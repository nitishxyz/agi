import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import type { SetuAuth } from './types.ts';

export interface WalletContext {
	walletAddress: string;
	buildWalletAuthHeaders:
		| (() => Promise<Record<string, string>>)
		| (() => Record<string, string>);
	/** @deprecated Use buildWalletAuthHeaders() instead. */
	buildHeaders:
		| (() => Promise<Record<string, string>>)
		| (() => Record<string, string>);
	keypair?: Keypair;
	privateKeyBytes?: Uint8Array;
	signTransaction?: (transaction: Uint8Array) => Promise<Uint8Array>;
}

export function createWalletContext(auth: SetuAuth): WalletContext {
	if (auth.signer) {
		const {
			walletAddress,
			signNonce: customSignNonce,
			signTransaction,
		} = auth.signer;
		const buildWalletAuthHeaders = async () => {
			const nonce = Date.now().toString();
			const signature = await customSignNonce(nonce);
			return {
				'x-wallet-address': walletAddress,
				'x-wallet-nonce': nonce,
				'x-wallet-signature': signature,
			};
		};
		return {
			walletAddress,
			signTransaction,
			buildWalletAuthHeaders,
			buildHeaders: buildWalletAuthHeaders,
		};
	}

	if (!auth.privateKey) {
		throw new Error('Setu: either privateKey or signer is required.');
	}

	const privateKeyBytes = bs58.decode(auth.privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	const walletAddress = keypair.publicKey.toBase58();
	const buildWalletAuthHeaders = () =>
		buildWalletHeaders(walletAddress, privateKeyBytes);
	return {
		keypair,
		walletAddress,
		privateKeyBytes,
		buildWalletAuthHeaders,
		buildHeaders: buildWalletAuthHeaders,
	};
}

export function signNonce(nonce: string, secretKey: Uint8Array): string {
	const data = new TextEncoder().encode(nonce);
	const signature = nacl.sign.detached(data, secretKey);
	return bs58.encode(signature);
}

export function buildWalletHeaders(
	walletAddress: string,
	privateKeyBytes: Uint8Array,
): Record<string, string> {
	const nonce = Date.now().toString();
	const signature = signNonce(nonce, privateKeyBytes);
	return {
		'x-wallet-address': walletAddress,
		'x-wallet-nonce': nonce,
		'x-wallet-signature': signature,
	};
}

export const buildWalletAuthHeaders = buildWalletHeaders;

export function getPublicKeyFromPrivate(privateKey?: string): string | null {
	if (!privateKey) return null;
	try {
		const privateKeyBytes = bs58.decode(privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		return keypair.publicKey.toBase58();
	} catch {
		return null;
	}
}
