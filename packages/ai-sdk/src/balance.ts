import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import type { SetuAuth, BalanceResponse, WalletUsdcBalance } from './types.ts';
import type { WalletContext } from './auth.ts';
import { createWalletContext } from './auth.ts';

const DEFAULT_BASE_URL = 'https://api.setu.ottocode.io';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

function trimTrailingSlash(url: string) {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isWalletContext(input: unknown): input is WalletContext {
	return (
		typeof input === 'object' &&
		input !== null &&
		'buildHeaders' in input &&
		typeof (input as WalletContext).buildHeaders === 'function'
	);
}

export async function fetchBalance(
	walletOrAuth: WalletContext | SetuAuth,
	baseURL?: string,
): Promise<BalanceResponse | null> {
	try {
		const wallet = isWalletContext(walletOrAuth)
			? walletOrAuth
			: createWalletContext(walletOrAuth);
		const url = trimTrailingSlash(baseURL ?? DEFAULT_BASE_URL);
		const headers = await wallet.buildHeaders();

		const response = await fetch(`${url}/v1/balance`, { headers });

		if (!response.ok) return null;

		const data = (await response.json()) as {
			wallet_address: string;
			balance_usd: number;
			total_spent: number;
			total_topups: number;
			request_count: number;
			created_at?: string;
			last_request?: string;
			scope?: 'wallet' | 'account';
			payg?: {
				wallet_balance_usd: number;
				account_balance_usd: number;
				raw_pool_usd: number;
				effective_spendable_usd: number;
			};
			limits?: {
				enabled: boolean;
				daily_limit_usd: number | null;
				daily_spent_usd: number;
				daily_remaining_usd: number | null;
				monthly_limit_usd: number | null;
				monthly_spent_usd: number;
				monthly_remaining_usd: number | null;
				cap_remaining_usd: number | null;
			} | null;
			subscription?: {
				active: boolean;
				tier_id?: string;
				tier_name?: string;
				credits_included?: number;
				credits_used?: number;
				credits_remaining?: number;
				period_start?: string;
				period_end?: string;
			} | null;
		};

		const result: BalanceResponse = {
			walletAddress: data.wallet_address,
			balance: data.balance_usd,
			totalSpent: data.total_spent,
			totalTopups: data.total_topups,
			requestCount: data.request_count,
			createdAt: data.created_at,
			lastRequest: data.last_request,
			scope: data.scope,
		};

		if (data.payg) {
			result.payg = {
				walletBalanceUsd: data.payg.wallet_balance_usd,
				accountBalanceUsd: data.payg.account_balance_usd,
				rawPoolUsd: data.payg.raw_pool_usd,
				effectiveSpendableUsd: data.payg.effective_spendable_usd,
			};
		}

		if (data.limits !== undefined) {
			result.limits = data.limits
				? {
						enabled: data.limits.enabled,
						dailyLimitUsd: data.limits.daily_limit_usd,
						dailySpentUsd: data.limits.daily_spent_usd,
						dailyRemainingUsd: data.limits.daily_remaining_usd,
						monthlyLimitUsd: data.limits.monthly_limit_usd,
						monthlySpentUsd: data.limits.monthly_spent_usd,
						monthlyRemainingUsd: data.limits.monthly_remaining_usd,
						capRemainingUsd: data.limits.cap_remaining_usd,
					}
				: null;
		}

		if (data.subscription !== undefined) {
			result.subscription = data.subscription
				? {
						active: data.subscription.active,
						tierId: data.subscription.tier_id,
						tierName: data.subscription.tier_name,
						creditsIncluded: data.subscription.credits_included,
						creditsUsed: data.subscription.credits_used,
						creditsRemaining: data.subscription.credits_remaining,
						periodStart: data.subscription.period_start,
						periodEnd: data.subscription.period_end,
					}
				: null;
		}

		return result;
	} catch {
		return null;
	}
}

type WalletUsdcBalanceInput =
	| Required<Pick<SetuAuth, 'privateKey'>>
	| { walletAddress: string };

function resolveWalletAddress(input: WalletUsdcBalanceInput): string {
	if ('walletAddress' in input) return input.walletAddress;
	const privateKeyBytes = bs58.decode(input.privateKey);
	const keypair = Keypair.fromSecretKey(privateKeyBytes);
	return keypair.publicKey.toBase58();
}

export async function fetchWalletUsdcBalance(
	input: WalletUsdcBalanceInput,
	network: 'mainnet' | 'devnet' = 'mainnet',
): Promise<WalletUsdcBalance | null> {
	try {
		const walletAddress = resolveWalletAddress(input);
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
