/**
 * Provider identifiers for supported AI providers
 */
export type ProviderId =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'openrouter'
	| 'opencode';

export type ModelProviderBinding = {
	id?: string;
	npm?: string;
	api?: string;
	baseURL?: string;
};

/**
 * Information about a specific model
 */
export type ModelInfo = {
	id: string;
	label?: string;
	modalities?: { input?: string[]; output?: string[] };
	toolCall?: boolean;
	reasoning?: boolean;
	attachment?: boolean;
	temperature?: boolean | number;
	knowledge?: string;
	releaseDate?: string;
	lastUpdated?: string;
	openWeights?: boolean;
	cost?: { input?: number; output?: number; cacheRead?: number };
	limit?: { context?: number; output?: number };
	provider?: ModelProviderBinding;
};

export type ProviderCatalogEntry = {
	id: ProviderId;
	label?: string;
	env?: string[];
	npm?: string;
	api?: string;
	doc?: string;
	models: ModelInfo[];
};
