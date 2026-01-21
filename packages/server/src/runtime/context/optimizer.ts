import type { ModelMessage } from 'ai';

/**
 * Optimizes message context by deduplicating file reads and pruning old tool results.
 */

interface FileRead {
	messageIndex: number;
	partIndex: number;
	path: string;
}

interface ToolPart {
	type: string;
	input?: {
		path?: string;
		filePattern?: string;
		pattern?: string;
	};
	output?: unknown;
	[key: string]: unknown;
}

/**
 * Deduplicates file read results, keeping only the latest version of each file.
 *
 * Strategy:
 * - Track all file reads (read, grep, glob tools)
 * - For files read multiple times, remove older results
 * - Keep only the most recent read of each file
 */
export function deduplicateFileReads(messages: ModelMessage[]): ModelMessage[] {
	const fileReads = new Map<string, FileRead[]>();

	// First pass: identify all file reads and their locations
	messages.forEach((msg, msgIdx) => {
		if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return;

		msg.content.forEach((part, partIdx) => {
			if (!part || typeof part !== 'object') return;
			if (!('type' in part)) return;

			const toolType = part.type as string;

			// Check if this is a file read tool (read, grep, glob)
			if (!toolType.startsWith('tool-')) return;

			const toolName = toolType.replace('tool-', '');
			if (!['read', 'grep', 'glob'].includes(toolName)) return;

			// Extract file path from input
			const toolPart = part as ToolPart;
			const input = toolPart.input;
			if (!input) return;

			const path = input.path || input.filePattern || input.pattern;
			if (!path) return;

			// Track this file read
			if (!fileReads.has(path)) {
				fileReads.set(path, []);
			}
			fileReads
				.get(path)
				?.push({ messageIndex: msgIdx, partIndex: partIdx, path });
		});
	});

	// Second pass: identify reads to remove (all but the latest for each file)
	const readsToRemove = new Set<string>();

	for (const [_path, reads] of fileReads) {
		if (reads.length <= 1) continue;

		// Sort by message index descending (latest first)
		reads.sort((a, b) => b.messageIndex - a.messageIndex);

		// Remove all but the first (latest)
		for (let i = 1; i < reads.length; i++) {
			const read = reads[i];
			readsToRemove.add(`${read.messageIndex}-${read.partIndex}`);
		}
	}

	// Third pass: rebuild messages without removed reads
	return messages.map((msg, msgIdx) => {
		if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg;

		const filteredContent = msg.content.filter((_part, partIdx) => {
			const key = `${msgIdx}-${partIdx}`;
			return !readsToRemove.has(key);
		});

		return {
			...msg,
			content: filteredContent,
		};
	});
}

/**
 * Prunes old tool results to reduce context size.
 *
 * Strategy:
 * - Keep only the last N tool results
 * - Preserve tool calls but remove their output
 * - Keep text parts intact
 */
export function pruneToolResults(
	messages: ModelMessage[],
	maxToolResults = 30,
): ModelMessage[] {
	// Collect all tool result locations
	const toolResults: Array<{ messageIndex: number; partIndex: number }> = [];

	messages.forEach((msg, msgIdx) => {
		if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return;

		msg.content.forEach((part, partIdx) => {
			if (!part || typeof part !== 'object') return;
			if (!('type' in part)) return;

			const toolType = part.type as string;
			if (!toolType.startsWith('tool-')) return;

			// Check if this has output
			const toolPart = part as ToolPart;
			const hasOutput = toolPart.output !== undefined;
			if (!hasOutput) return;

			toolResults.push({ messageIndex: msgIdx, partIndex: partIdx });
		});
	});

	// If under limit, no pruning needed
	if (toolResults.length <= maxToolResults) {
		return messages;
	}

	// Keep only the last N tool results
	const toKeep = new Set<string>();
	const keepCount = Math.min(maxToolResults, toolResults.length);
	const keepStart = toolResults.length - keepCount;

	for (let i = keepStart; i < toolResults.length; i++) {
		const result = toolResults[i];
		toKeep.add(`${result.messageIndex}-${result.partIndex}`);
	}

	// Rebuild messages, removing old tool outputs
	return messages.map((msg, msgIdx) => {
		if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg;

		const processedContent = msg.content.map((part, partIdx) => {
			if (!part || typeof part !== 'object') return part;
			if (!('type' in part)) return part;

			const toolPart = part as ToolPart;
			const toolType = toolPart.type;
			if (!toolType.startsWith('tool-')) return part;

			const key = `${msgIdx}-${partIdx}`;
			const hasOutput = toolPart.output !== undefined;

			// If this tool result should be pruned, remove its output
			if (hasOutput && !toKeep.has(key)) {
				return {
					...part,
					output: '[pruned to save context]',
				};
			}

			return part;
		});

		return {
			...msg,
			content: processedContent,
		};
	});
}

/**
 * Applies all context optimizations:
 * 1. Deduplicate file reads
 * 2. Prune old tool results
 */
export function optimizeContext(
	messages: ModelMessage[],
	options: {
		deduplicateFiles?: boolean;
		maxToolResults?: number;
	} = {},
): ModelMessage[] {
	let optimized = messages;

	if (options.deduplicateFiles !== false) {
		optimized = deduplicateFileReads(optimized);
	}

	if (options.maxToolResults !== undefined) {
		optimized = pruneToolResults(optimized, options.maxToolResults);
	}

	return optimized;
}
