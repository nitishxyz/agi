/**
 * Provider identifiers for supported AI providers
 */
export type ProviderId =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'openrouter'
	| 'opencode'
	| 'copilot'
	| 'setu'
	| 'zai'
	| 'zai-coding'
	| 'moonshot';

/**
 * Provider family for prompt selection
 */
export type ProviderFamily =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'moonshot'
	| 'openai-compatible';

export type ModelProviderBinding = {
	id?: string;
	npm?: string;
	api?: string;
	baseURL?: string;
	/**
	 * The provider family for prompt selection.
	 * Used to determine which base prompt to use for this model.
	 */
	family?: ProviderFamily;
};

/**
 * Information about a specific model
 */
export type ModelInfo = {
	id: string;
	label?: string;
	modalities?: { input?: string[]; output?: string[] };
	toolCall?: boolean;
	reasoningText?: boolean;
	attachment?: boolean;
	temperature?: boolean | number;
	knowledge?: string;
	releaseDate?: string;
	lastUpdated?: string;
	openWeights?: boolean;
	cost?: {
		input?: number;
		output?: number;
		cacheRead?: number;
		cacheWrite?: number;
	};
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
