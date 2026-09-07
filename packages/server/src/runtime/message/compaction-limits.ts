import { catalog, getModelInfo } from '@ottocode/sdk';
import type { BuiltInProviderId, ProviderId } from '@ottocode/sdk';

export const PRUNE_PROTECT = 40_000;

export function estimateTokens(text: string): number {
	return Math.max(0, Math.round((text || '').length / 4));
}

export interface ModelLimits {
	context: number;
	output: number;
}

type CompactionStepUsage = {
	inputTokens?: number | null;
	outputTokens?: number | null;
};

function normalizeTokenCount(value?: number | null): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export function resolveAutoCompactThresholdTokens(args: {
	configuredThresholdTokens?: number | null;
	modelContextWindow?: number | null;
}): number | null {
	const configuredThreshold = Math.floor(
		Number(args.configuredThresholdTokens ?? 0),
	);
	if (!Number.isFinite(configuredThreshold) || configuredThreshold <= 0) {
		return null;
	}

	const modelContextWindow = Math.floor(Number(args.modelContextWindow ?? 0));
	if (
		Number.isFinite(modelContextWindow) &&
		modelContextWindow > 0 &&
		configuredThreshold >= modelContextWindow
	) {
		return null;
	}

	return configuredThreshold;
}

export function shouldAutoCompactBeforeOverflow(args: {
	autoCompactThresholdTokens?: number | null;
	currentContextTokens?: number | null;
	estimatedInputTokens?: number | null;
	isCompactCommand?: boolean;
	compactionRetries?: number;
}): boolean {
	const threshold = Number(args.autoCompactThresholdTokens ?? 0);
	if (!Number.isFinite(threshold) || threshold <= 0) {
		return false;
	}
	if (args.isCompactCommand) {
		return false;
	}
	if ((args.compactionRetries ?? 0) > 0) {
		return false;
	}

	const currentContextTokens = normalizeTokenCount(args.currentContextTokens);
	if (currentContextTokens <= 0) {
		return false;
	}

	const estimatedInputTokens = normalizeTokenCount(args.estimatedInputTokens);

	return currentContextTokens + estimatedInputTokens >= threshold;
}

export function shouldStopTurnForAutoCompact(args: {
	autoCompactThresholdTokens?: number | null;
	isCompactCommand?: boolean;
	compactionRetries?: number;
	lastStepUsage?: CompactionStepUsage | null;
}): boolean {
	const threshold = Number(args.autoCompactThresholdTokens ?? 0);
	if (!Number.isFinite(threshold) || threshold <= 0) {
		return false;
	}
	if (args.isCompactCommand) {
		return false;
	}
	if ((args.compactionRetries ?? 0) > 0) {
		return false;
	}

	const inputTokens = normalizeTokenCount(args.lastStepUsage?.inputTokens);
	if (inputTokens <= 0) {
		return false;
	}
	const outputTokens = normalizeTokenCount(args.lastStepUsage?.outputTokens);

	return inputTokens + outputTokens >= threshold;
}

export function shouldAutoCompactAfterTurn(args: {
	autoCompactThresholdTokens?: number | null;
	currentContextTokens?: number | null;
	isCompactCommand?: boolean;
	compactionRetries?: number;
	turnStoppedForCompaction?: boolean;
	lastStepUsage?: CompactionStepUsage | null;
}): boolean {
	if (args.isCompactCommand || (args.compactionRetries ?? 0) > 0) {
		return false;
	}

	const threshold = Number(args.autoCompactThresholdTokens ?? 0);
	if (!Number.isFinite(threshold) || threshold <= 0) {
		return false;
	}

	if (args.turnStoppedForCompaction) {
		return true;
	}

	if (normalizeTokenCount(args.lastStepUsage?.inputTokens) > 0) {
		return shouldStopTurnForAutoCompact(args);
	}

	return shouldAutoCompactBeforeOverflow({
		autoCompactThresholdTokens: threshold,
		currentContextTokens: args.currentContextTokens,
		estimatedInputTokens: 0,
		isCompactCommand: args.isCompactCommand,
		compactionRetries: args.compactionRetries,
	});
}

export function getModelLimits(
	provider: string,
	model: string,
): ModelLimits | null {
	const info = getModelInfo(provider as ProviderId, model);
	if (info?.limit?.context && info?.limit?.output) {
		return { context: info.limit.context, output: info.limit.output };
	}
	for (const key of Object.keys(catalog) as BuiltInProviderId[]) {
		const entry = catalog[key];
		const m = entry?.models?.[model];
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
