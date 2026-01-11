/**
 * Context compaction module for managing token usage.
 *
 * This module implements OpenCode-style context management:
 * 1. Detects when context is overflowing (tokens > context_limit - output_limit)
 * 2. Prunes old tool outputs by marking them as "compacted"
 * 3. History builder returns "[Old tool result content cleared]" for compacted parts
 *
 * Pruning strategy:
 * - Protect the last PRUNE_PROTECT tokens worth of tool calls (40,000)
 * - Only prune if we'd save at least PRUNE_MINIMUM tokens (20,000)
 * - Skip the last 2 turns to preserve recent context
 * - Never prune "skill" or other protected tools
 */

import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq, desc } from 'drizzle-orm';
import { debugLog } from './debug.ts';

// Token thresholds (matching OpenCode)
export const PRUNE_MINIMUM = 20_000; // Only prune if we'd save at least this many tokens
export const PRUNE_PROTECT = 40_000; // Protect last N tokens worth of tool calls

// Tools that should never be pruned
const PRUNE_PROTECTED_TOOLS = ['skill'];

// Simple token estimation: ~4 chars per token
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

/**
 * Check if context is overflowing based on token usage and model limits.
 * Returns true if we've used more tokens than (context_limit - output_limit).
 */
export function isOverflow(tokens: TokenUsage, limits: ModelLimits): boolean {
	if (limits.context === 0) return false;

	const count = tokens.input + (tokens.cacheRead ?? 0) + tokens.output;
	const usableContext = limits.context - limits.output;

	const overflow = count > usableContext;
	if (overflow) {
		debugLog(
			`[compaction] Context overflow detected: ${count} tokens used, ${usableContext} usable (${limits.context} context - ${limits.output} output)`,
		);
	}

	return overflow;
}

/**
 * Prune old tool outputs from a session to reduce context size.
 *
 * Goes backwards through tool results, protecting the last PRUNE_PROTECT tokens.
 * Marks older tool results as "compacted" so history builder returns placeholder text.
 */
export async function pruneSession(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
): Promise<{ pruned: number; saved: number }> {
	debugLog(`[compaction] Starting prune for session ${sessionId}`);

	// Get all messages in the session ordered by creation time
	const allMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(desc(messages.createdAt));

	let totalTokens = 0;
	let prunedTokens = 0;
	const toPrune: Array<{ id: string; content: string }> = [];
	let turns = 0;

	// Go backwards through messages
	for (const msg of allMessages) {
		// Count user messages as turns
		if (msg.role === 'user') {
			turns++;
		}

		// Skip the last 2 turns to preserve recent context
		if (turns < 2) continue;

		// Get all parts for this message
		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(desc(messageParts.index));

		for (const part of parts) {
			// Only process tool results
			if (part.type !== 'tool_result') continue;

			// Skip protected tools
			if (part.toolName && PRUNE_PROTECTED_TOOLS.includes(part.toolName)) {
				continue;
			}

			// Parse content to check if already compacted
			let content: { result?: unknown; compactedAt?: number };
			try {
				content = JSON.parse(part.content ?? '{}');
			} catch {
				continue;
			}

			// Stop if we hit already compacted content (we've pruned before)
			if (content.compactedAt) {
				debugLog(
					`[compaction] Hit previously compacted content, stopping prune`,
				);
				break;
			}

			// Estimate tokens for this result
			const estimate = estimateTokens(
				typeof content.result === 'string'
					? content.result
					: JSON.stringify(content.result ?? ''),
			);
			totalTokens += estimate;

			// If we've exceeded the protection threshold, mark for pruning
			if (totalTokens > PRUNE_PROTECT) {
				prunedTokens += estimate;
				toPrune.push({ id: part.id, content: part.content ?? '{}' });
			}
		}
	}

	debugLog(
		`[compaction] Found ${toPrune.length} tool results to prune, saving ~${prunedTokens} tokens`,
	);

	// Only prune if we'd save enough tokens to be worthwhile
	if (prunedTokens > PRUNE_MINIMUM) {
		const compactedAt = Date.now();

		for (const part of toPrune) {
			try {
				const content = JSON.parse(part.content);
				// Keep the structure but mark as compacted
				content.compactedAt = compactedAt;
				// Keep a small summary if it was a string result
				if (typeof content.result === 'string' && content.result.length > 100) {
					content.resultSummary = `${content.result.slice(0, 100)}...`;
				}
				// Clear the actual result to save space
				content.result = null;

				await db
					.update(messageParts)
					.set({ content: JSON.stringify(content) })
					.where(eq(messageParts.id, part.id));
			} catch (err) {
				debugLog(
					`[compaction] Failed to prune part ${part.id}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		debugLog(
			`[compaction] Pruned ${toPrune.length} tool results, saved ~${prunedTokens} tokens`,
		);
	} else {
		debugLog(
			`[compaction] Skipping prune, would only save ${prunedTokens} tokens (min: ${PRUNE_MINIMUM})`,
		);
	}

	return { pruned: toPrune.length, saved: prunedTokens };
}

/**
 * Get model limits from provider catalog or use defaults.
 */
export function getModelLimits(
	provider: string,
	model: string,
): ModelLimits | null {
	// Default limits for common models
	// These should ideally come from the provider catalog
	const defaults: Record<string, ModelLimits> = {
		// Anthropic
		'claude-sonnet-4-20250514': { context: 200000, output: 16000 },
		'claude-3-5-sonnet-20241022': { context: 200000, output: 8192 },
		'claude-3-5-haiku-20241022': { context: 200000, output: 8192 },
		'claude-3-opus-20240229': { context: 200000, output: 4096 },
		// OpenAI
		'gpt-4o': { context: 128000, output: 16384 },
		'gpt-4o-mini': { context: 128000, output: 16384 },
		'gpt-4-turbo': { context: 128000, output: 4096 },
		o1: { context: 200000, output: 100000 },
		'o1-mini': { context: 128000, output: 65536 },
		'o1-pro': { context: 200000, output: 100000 },
		'o3-mini': { context: 200000, output: 100000 },
		// Google
		'gemini-2.0-flash': { context: 1000000, output: 8192 },
		'gemini-1.5-pro': { context: 2000000, output: 8192 },
		'gemini-1.5-flash': { context: 1000000, output: 8192 },
	};

	// Try exact match first
	if (defaults[model]) {
		return defaults[model];
	}

	// Try partial match (e.g., "claude-3-5-sonnet" matches "claude-3-5-sonnet-20241022")
	for (const [key, limits] of Object.entries(defaults)) {
		if (model.includes(key) || key.includes(model)) {
			return limits;
		}
	}

	// Return null if no match - caller should handle
	debugLog(
		`[compaction] No model limits found for ${provider}/${model}, skipping overflow check`,
	);
	return null;
}

/**
 * Check if a tool result content is compacted.
 */
export function isCompacted(content: string): boolean {
	try {
		const parsed = JSON.parse(content);
		return !!parsed.compactedAt;
	} catch {
		return false;
	}
}

/**
 * Get the placeholder text for compacted tool results.
 */
export const COMPACTED_PLACEHOLDER = '[Old tool result content cleared]';
