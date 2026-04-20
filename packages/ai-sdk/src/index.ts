export { createOttoRouter } from './ottorouter.ts';
export type { OttoRouterInstance, OttoRouterProvider } from './ottorouter.ts';

export type {
	OttoRouterConfig,
	OttoRouterAuth,
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
	FetchFunction,
	AnthropicCacheStrategy,
	AnthropicCachePlacement,
	AnthropicCacheConfig,
} from './types.ts';

export { ProviderRegistry } from './providers/registry.ts';
export { createModel } from './providers/factory.ts';

export {
	createOttoRouterFetch,
	createOttoRouterOpenRouterFetch,
} from './fetch.ts';
export type { CreateOttoRouterFetchOptions } from './fetch.ts';

export { fetchBalance, fetchWalletUsdcBalance } from './balance.ts';
export { getPublicKeyFromPrivate, createWalletContext } from './auth.ts';
export type { WalletContext } from './auth.ts';
export { addAnthropicCacheControl } from './cache.ts';

export { generateWallet, importWallet, isValidPrivateKey } from './wallet.ts';
export type { WalletInfo } from './wallet.ts';

export { ottorouterCatalog } from './catalog.ts';
export type {
	OttoRouterModelCatalogEntry,
	OttoRouterCatalog,
} from './catalog.ts';
