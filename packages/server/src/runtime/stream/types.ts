import type { UsageData, ProviderMetadata } from '../session/db-operations.ts';

export type StepFinishEvent = {
	usage?: UsageData;
	finishReason?: string;
	response?: unknown;
	experimental_providerMetadata?: ProviderMetadata;
};

export type FinishEvent = {
	usage?: Pick<
		UsageData,
		| 'inputTokens'
		| 'outputTokens'
		| 'totalTokens'
		| 'cachedInputTokens'
		| 'cacheCreationInputTokens'
		| 'reasoningTokens'
	>;
	finishReason?: string;
};

export type AbortEvent = {
	steps: unknown[];
};
