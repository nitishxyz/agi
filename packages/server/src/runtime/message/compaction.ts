export {
	PRUNE_PROTECT,
	estimateTokens,
	type TokenUsage,
	type ModelLimits,
	isOverflow,
	getModelLimits,
	isCompacted,
	COMPACTED_PLACEHOLDER,
} from './compaction-limits.ts';

export {
	isCompactCommand,
	getCompactionSystemPrompt,
} from './compaction-detect.ts';

export { buildCompactionContext } from './compaction-context.ts';

export { markSessionCompacted } from './compaction-mark.ts';

export { pruneSession } from './compaction-prune.ts';

export { performAutoCompaction } from './compaction-auto.ts';
