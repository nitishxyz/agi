import {
	createSetu,
	fetchBalance,
	fetchWalletUsdcBalance,
	getPublicKeyFromPrivate as _getPublicKeyFromPrivate,
	addAnthropicCacheControl as _addAnthropicCacheControl,
	createSetuFetch as _createSetuFetch,
	type SetuConfig,
	type PaymentCallbacks,
	type BalanceUpdate,
	type BalanceResponse,
	type WalletUsdcBalance,
	type SetuAuth as _SetuAuth,
	type SetuInstance,
} from '@ottocode/ai-sdk';

export type SetuBalanceUpdate = BalanceUpdate;

export type SetuPaymentCallbacks = PaymentCallbacks;

export type SetuProviderOptions = {
	baseURL?: string;
	rpcURL?: string;
	network?: string;
	maxRequestAttempts?: number;
	maxPaymentAttempts?: number;
	callbacks?: SetuPaymentCallbacks;
	providerNpm?: string;
	promptCacheKey?: string;
	promptCacheRetention?: 'in_memory' | '24h';
	topupApprovalMode?: 'auto' | 'approval';
	autoPayThresholdUsd?: number;
};

export type SetuAuth = _SetuAuth;

export type SetuBalanceResponse = BalanceResponse;

export type SolanaUsdcBalanceResponse = WalletUsdcBalance;

export function createSetuFetch(
	auth: SetuAuth,
	options: SetuProviderOptions = {},
): typeof fetch {
	const setu = createSetu(buildSetuConfig(auth, options));
	return setu.fetch() as typeof fetch;
}

export function createSetuModel(
	model: string,
	auth: SetuAuth,
	options: SetuProviderOptions = {},
) {
	const setu = createSetu(buildSetuConfig(auth, options));
	return setu.model(model);
}

function buildSetuConfig(
	auth: SetuAuth,
	options: SetuProviderOptions = {},
): SetuConfig {
	return {
		auth,
		baseURL: options.baseURL,
		rpcURL: options.rpcURL,
		callbacks: options.callbacks,
		cache: {
			promptCacheKey: options.promptCacheKey,
			promptCacheRetention: options.promptCacheRetention,
		},
		payment: {
			topupApprovalMode: options.topupApprovalMode,
			autoPayThresholdUsd: options.autoPayThresholdUsd,
			maxRequestAttempts: options.maxRequestAttempts,
			maxPaymentAttempts: options.maxPaymentAttempts,
		},
	};
}

export async function fetchSetuBalance(
	auth: SetuAuth,
	baseURL?: string,
): Promise<SetuBalanceResponse | null> {
	return fetchBalance(auth, baseURL);
}

export function getPublicKeyFromPrivate(privateKey: string): string | null {
	return _getPublicKeyFromPrivate(privateKey);
}

export async function fetchSolanaUsdcBalance(
	auth: SetuAuth,
	network: 'mainnet' | 'devnet' = 'mainnet',
): Promise<SolanaUsdcBalanceResponse | null> {
	return fetchWalletUsdcBalance(auth, network);
}

export { createSetu, type SetuInstance };
