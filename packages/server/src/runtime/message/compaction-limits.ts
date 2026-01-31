import { catalog, getModelInfo } from '@agi-cli/sdk';
import type { ProviderId } from '@agi-cli/sdk';

export const PRUNE_PROTECT = 40_000;

export function estimateTokens(text: string): number {
	return Math.max(0, Math.round((text || '').length / 4));
}

export interface TokenUsage {
	input: number;
	output: number;
	cacheRead?: number;
	cacheWrite?: number;
	reasoningText?: number;
}

export interface ModelLimits {
	context: number;
	output: number;
}

export function isOverflow(
	tokens: LanguageModelUsage,
	limits: ModelLimits,
): boolean {
	if (limits.context === 0) return false;

	const count =
		tokens.input +
		(tokens.cacheRead ?? 0) +
		(tokens.cacheWrite ?? 0) +
		tokens.output;
	const usableContext = limits.context - limits.output;

	return count > usableContext;
}

export function getModelLimits(
	provider: string,
	model: string,
): ModelLimits | null {
	const info = getModelInfo(provider as ProviderId, model);
	if (info?.limit?.context && info?.limit?.output) {
		return { context: info.limit.context, output: info.limit.output };
	}
	for (const key of Object.keys(catalog) as ProviderId[]) {
		const entry = catalog[key];
		const m = entry?.models?.find((x) => x.id === model);
		if (m?.limit?.context && m?.limit?.output) {
			return { context: m.limit.context, output: m.limit.output };
		}
	}
	return null;
}

export function isCompacted(part: { compactedAt?: number | null }): boolean {
	return !!part.compactedAt;
}

export const COMPACTED_PLACEHOLDER = '[Compacted]';
