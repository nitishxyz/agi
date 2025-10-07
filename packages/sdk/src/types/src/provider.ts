/**
 * Provider identifiers for supported AI providers
 */
export type ProviderId =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'openrouter'
	| 'opencode';

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
};
