export { createSetu } from './setu.ts';
export type { SetuInstance, SetuProvider } from './setu.ts';

export type {
	SetuConfig,
	SetuAuth,
	ExternalSigner,
	ProviderId,
	ProviderApiFormat,
	ProviderConfig,
	PaymentCallbacks,
	PaymentOptions,
	CacheOptions,
	BalanceUpdate,
	BalanceResponse,
	WalletUsdcBalance,
	ExactPaymentRequirement,
	PaymentPayload,
	FetchFunction,
	AnthropicCacheStrategy,
	AnthropicCachePlacement,
	AnthropicCacheConfig,
} from './types.ts';

export { ProviderRegistry } from './providers/registry.ts';
export { createModel } from './providers/factory.ts';

export { createSetuFetch } from './fetch.ts';
export type { CreateSetuFetchOptions } from './fetch.ts';

export { fetchBalance, fetchWalletUsdcBalance } from './balance.ts';
export { getPublicKeyFromPrivate, createWalletContext } from './auth.ts';
export type { WalletContext } from './auth.ts';
export { addAnthropicCacheControl } from './cache.ts';

export { generateWallet, importWallet, isValidPrivateKey } from './wallet.ts';
export type { WalletInfo } from './wallet.ts';

export { setuCatalog } from './catalog.ts';
export type { SetuModelCatalogEntry, SetuCatalog } from './catalog.ts';
