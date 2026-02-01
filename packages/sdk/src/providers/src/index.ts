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
	getModelNpmBinding,
	isAnthropicBasedModel,
	getUnderlyingProviderKey,
	getModelFamily,
	getModelInfo,
	modelSupportsReasoning,
} from './utils.ts';
export type { UnderlyingProviderKey } from './utils.ts';
export { validateProviderModel } from './validate.ts';
export { estimateModelCostUsd } from './pricing.ts';
export { providerEnvVar, readEnvKey, setEnvKey } from './env.ts';
export {
	createSetuFetch,
	createSetuModel,
	fetchSetuBalance,
	getPublicKeyFromPrivate,
	fetchSolanaUsdcBalance,
} from './setu-client.ts';
export type {
	SetuAuth,
	SetuProviderOptions,
	SetuPaymentCallbacks,
	SetuBalanceResponse,
	SolanaUsdcBalanceResponse,
} from './setu-client.ts';
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
export {
	addAnthropicCacheControl,
	createAnthropicCachingFetch,
	createConditionalCachingFetch,
} from './anthropic-caching.ts';
export {
	createAnthropicOAuthFetch,
	createAnthropicOAuthModel,
} from './anthropic-oauth-client.ts';
export type { AnthropicOAuthConfig } from './anthropic-oauth-client.ts';
export { createGoogleModel } from './google-client.ts';
export type { GoogleProviderConfig } from './google-client.ts';
export { createZaiModel, createZaiCodingModel } from './zai-client.ts';
export type { ZaiProviderConfig } from './zai-client.ts';
export {
	getOpenRouterInstance,
	createOpenRouterModel,
} from './openrouter-client.ts';
export type { OpenRouterProviderConfig } from './openrouter-client.ts';
export { createOpencodeModel } from './opencode-client.ts';
export type { OpencodeProviderConfig } from './opencode-client.ts';
export { createMoonshotModel } from './moonshot-client.ts';
export type { MoonshotProviderConfig } from './moonshot-client.ts';
