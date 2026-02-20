import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export interface WalletInfo {
	publicKey: string;
	privateKey: string;
}

export function generateWallet(): WalletInfo {
	const keypair = Keypair.generate();
	return {
		privateKey: bs58.encode(keypair.secretKey),
		publicKey: keypair.publicKey.toBase58(),
	};
}

export function importWallet(privateKey: string): WalletInfo {
	const privateKeyBytes = bs58.decode(privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	return {
		privateKey,
		publicKey: keypair.publicKey.toBase58(),
	};
}

export function isValidPrivateKey(privateKey: string): boolean {
	try {
		const bytes = bs58.decode(privateKey);
		Keypair.fromSecretKey(bytes);
		return true;
	} catch {
		return false;
	}
}
