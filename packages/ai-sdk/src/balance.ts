import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import type { SetuAuth, BalanceResponse, WalletUsdcBalance } from './types.ts';
import { signNonce } from './auth.ts';

const DEFAULT_BASE_URL = 'https://api.setu.ottocode.io';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

function trimTrailingSlash(url: string) {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function fetchBalance(
	auth: Required<SetuAuth>,
	baseURL?: string,
): Promise<BalanceResponse | null> {
	try {
		const privateKeyBytes = bs58.decode(auth.privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		const walletAddress = keypair.publicKey.toBase58();
		const url = trimTrailingSlash(baseURL ?? DEFAULT_BASE_URL);

		const nonce = Date.now().toString();
		const signature = signNonce(nonce, privateKeyBytes);

		const response = await fetch(`${url}/v1/balance`, {
			headers: {
				'x-wallet-address': walletAddress,
				'x-wallet-nonce': nonce,
				'x-wallet-signature': signature,
			},
		});

		if (!response.ok) return null;

		const data = (await response.json()) as {
			wallet_address: string;
			balance_usd: number;
			total_spent: number;
			total_topups: number;
			request_count: number;
			created_at?: string;
			last_request?: string;
		};

		return {
			walletAddress: data.wallet_address,
			balance: data.balance_usd,
			totalSpent: data.total_spent,
			totalTopups: data.total_topups,
			requestCount: data.request_count,
			createdAt: data.created_at,
			lastRequest: data.last_request,
		};
	} catch {
		return null;
	}
}

export async function fetchWalletUsdcBalance(
	auth: Required<SetuAuth>,
	network: 'mainnet' | 'devnet' = 'mainnet',
): Promise<WalletUsdcBalance | null> {
	try {
		const privateKeyBytes = bs58.decode(auth.privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		const walletAddress = keypair.publicKey.toBase58();
		const rpcUrl =
			network === 'devnet' ? 'https://api.devnet.solana.com' : DEFAULT_RPC_URL;
		const usdcMint =
			network === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;

		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'getTokenAccountsByOwner',
				params: [walletAddress, { mint: usdcMint }, { encoding: 'jsonParsed' }],
			}),
		});

		if (!response.ok) return null;

		const data = (await response.json()) as {
			result?: {
				value?: Array<{
					account: {
						data: {
							parsed: {
								info: { tokenAmount: { uiAmount: number } };
							};
						};
					};
				}>;
			};
		};

		let totalUsdcBalance = 0;
		for (const account of data.result?.value ?? []) {
			totalUsdcBalance +=
				account.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
		}

		return { walletAddress, usdcBalance: totalUsdcBalance, network };
	} catch {
		return null;
	}
}
