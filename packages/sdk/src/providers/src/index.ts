export { isProviderAuthorized, ensureProviderEnv } from './authorization.ts';
export { catalog } from './catalog-merged.ts';
export type {
	ProviderId,
	ModelInfo,
	ModelProviderBinding,
	ProviderCatalogEntry,
} from '../../types/src/index.ts';
export {
	isProviderId,
	providerIds,
	defaultModelFor,
	hasModel,
	getFastModel,
	getFastModelForAuth,
} from './utils.ts';
export { validateProviderModel } from './validate.ts';
export { estimateModelCostUsd } from './pricing.ts';
export { providerEnvVar, readEnvKey, setEnvKey } from './env.ts';
export {
	createSolforgeFetch,
	createSolforgeModel,
	fetchSolforgeBalance,
	getPublicKeyFromPrivate,
	fetchSolanaUsdcBalance,
} from './solforge-client.ts';
export type {
	SolforgeAuth,
	SolforgeProviderOptions,
	SolforgePaymentCallbacks,
	SolforgeBalanceResponse,
	SolanaUsdcBalanceResponse,
} from './solforge-client.ts';
export {
	createOpenAIOAuthFetch,
	createOpenAIOAuthModel,
} from './openai-oauth-client.ts';
export type { OpenAIOAuthConfig } from './openai-oauth-client.ts';
export {
	isModelAllowedForOAuth,
	filterModelsForAuthType,
	getOAuthModelPrefixes,
} from './oauth-models.ts';
