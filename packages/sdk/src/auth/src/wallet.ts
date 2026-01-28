import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getAuth, setAuth } from './index.ts';

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

export async function getSetuWallet(
	projectRoot?: string,
): Promise<WalletInfo | null> {
	const auth = await getAuth('setu', projectRoot);
	if (auth?.type === 'wallet' && auth.secret) {
		return importWallet(auth.secret);
	}
	return null;
}

export async function ensureSetuWallet(
	projectRoot?: string,
): Promise<WalletInfo> {
	const existing = await getSetuWallet(projectRoot);
	if (existing) return existing;

	const wallet = generateWallet();
	await setAuth(
		'setu',
		{ type: 'wallet', secret: wallet.privateKey },
		projectRoot,
		'global',
	);
	return wallet;
}
