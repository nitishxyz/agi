export const PRUNE_PROTECT = 40_000;

export function estimateTokens(text: string): number {
	return Math.max(0, Math.round((text || '').length / 4));
}

export interface TokenUsage {
	input: number;
	output: number;
	cacheRead?: number;
	cacheWrite?: number;
	reasoning?: number;
}

export interface ModelLimits {
	context: number;
	output: number;
}

export function isOverflow(tokens: TokenUsage, limits: ModelLimits): boolean {
	if (limits.context === 0) return false;

	const count = tokens.input + (tokens.cacheRead ?? 0) + tokens.output;
	const usableContext = limits.context - limits.output;

	return count > usableContext;
}

export function getModelLimits(
	_provider: string,
	model: string,
): ModelLimits | null {
	const defaults: Record<string, ModelLimits> = {
		'claude-sonnet-4-20250514': { context: 200000, output: 16000 },
		'claude-3-5-sonnet-20241022': { context: 200000, output: 8192 },
		'claude-3-5-haiku-20241022': { context: 200000, output: 8192 },
		'gpt-4o': { context: 128000, output: 16384 },
		'gpt-4o-mini': { context: 128000, output: 16384 },
		o1: { context: 200000, output: 100000 },
		'o3-mini': { context: 200000, output: 100000 },
		'gemini-2.0-flash': { context: 1000000, output: 8192 },
		'gemini-1.5-pro': { context: 2000000, output: 8192 },
	};

	if (defaults[model]) return defaults[model];

	for (const [key, limits] of Object.entries(defaults)) {
		if (model.includes(key) || key.includes(model)) return limits;
	}

	return null;
}

export function isCompacted(part: { compactedAt?: number | null }): boolean {
	return !!part.compactedAt;
}

export const COMPACTED_PLACEHOLDER = '[Compacted]';
