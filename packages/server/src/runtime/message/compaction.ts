/**
 * Context compaction module for managing token usage.
 *
 * This module implements intelligent context management:
 * 1. Detects /compact command and builds summarization context
 * 2. After LLM responds with summary, marks old parts as compacted
 * 3. History builder skips compacted parts entirely
 *
 * Flow:
 * - User sends "/compact" → stored as regular user message
 * - Runner detects command, builds context for LLM to summarize
 * - LLM streams summary response naturally
 * - On completion, markSessionCompacted() marks old tool_call/tool_result parts
 * - Future history builds skip compacted parts
 */

import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq, desc, asc, and, lt } from 'drizzle-orm';
import { debugLog } from '../debug/index.ts';
import { streamText } from 'ai';
import { resolveModel } from '../provider/index.ts';
import { loadConfig } from '@agi-cli/sdk';

// Token thresholds
export const PRUNE_PROTECT = 40_000; // Protect last N tokens worth of tool calls

// Tools that should never be compacted
const PROTECTED_TOOLS = ['skill'];

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
 * Check if a message content is the /compact command.
 */
export function isCompactCommand(content: string): boolean {
	const trimmed = content.trim().toLowerCase();
	return trimmed === '/compact';
}

/**
 * Build context for the LLM to generate a summary.
 * Returns a prompt that describes what to summarize.
 * Includes tool calls and results with appropriate truncation to fit within model limits.
 * @param contextTokenLimit - Max tokens for context (uses ~4 chars per token estimate)
 */
export async function buildCompactionContext(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	contextTokenLimit?: number,
): Promise<string> {
	const allMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt));

	const lines: string[] = [];
	let totalChars = 0;
	// Use provided limit or default to 60k chars (~15k tokens)
	// We use ~50% of model context for compaction, leaving room for system prompt + response
	const maxChars = contextTokenLimit ? contextTokenLimit * 4 : 60000;

	for (const msg of allMessages) {
		if (totalChars > maxChars) {
			lines.unshift('[...earlier content truncated...]');
			break;
		}

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(asc(messageParts.index));

		for (const part of parts) {
			if (part.compactedAt) continue; // Skip already compacted

			try {
				const content = JSON.parse(part.content ?? '{}');

				if (part.type === 'text' && content.text) {
					const text = `[${msg.role.toUpperCase()}]: ${content.text}`;
					lines.push(text.slice(0, 3000)); // Allow more text content
					totalChars += text.length;
				} else if (part.type === 'tool_call' && content.name) {
					// Include tool name and relevant args (file paths, commands, etc.)
					const argsStr =
						typeof content.args === 'object'
							? JSON.stringify(content.args).slice(0, 500)
							: '';
					const text = `[TOOL ${content.name}]: ${argsStr}`;
					lines.push(text);
					totalChars += text.length;
				} else if (part.type === 'tool_result' && content.result !== null) {
					// Include enough result context for the LLM to understand what happened
					const resultStr =
						typeof content.result === 'string'
							? content.result.slice(0, 1500)
							: JSON.stringify(content.result ?? '').slice(0, 1500);
					const text = `[RESULT]: ${resultStr}`;
					lines.push(text);
					totalChars += text.length;
				}
			} catch {}
		}
	}

	return lines.join('\n');
}

/**
 * Get the system prompt addition for compaction.
 */
export function getCompactionSystemPrompt(): string {
	return `
The user has requested to compact the conversation. Generate a comprehensive summary that captures:

1. **Main Goals**: What was the user trying to accomplish?
2. **Key Actions**: What files were created, modified, or deleted?
3. **Important Decisions**: What approaches or solutions were chosen and why?
4. **Current State**: What is done and what might be pending?
5. **Critical Context**: Any gotchas, errors encountered, or important details for continuing.

Format your response as a clear, structured summary. Start with "📦 **Context Compacted**" header.
Keep under 2000 characters but be thorough. This summary will replace detailed tool history.
`;
}

/**
 * Mark old tool_call and tool_result parts as compacted.
 * Called after the compaction summary response is complete.
 *
 * Protects:
 * - Last N tokens of tool results (PRUNE_PROTECT)
 * - Last 2 user turns
 * - Protected tool names (skill, etc.)
 */
export async function markSessionCompacted(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	compactMessageId: string,
): Promise<{ compacted: number; saved: number }> {
	debugLog(`[compaction] Marking session ${sessionId} as compacted`);

	// Get the compact message to find the cutoff point
	const compactMsg = await db
		.select()
		.from(messages)
		.where(eq(messages.id, compactMessageId))
		.limit(1);

	if (!compactMsg.length) {
		debugLog('[compaction] Compact message not found');
		return { compacted: 0, saved: 0 };
	}

	const cutoffTime = compactMsg[0].createdAt;

	// Get all messages before the compact command
	const oldMessages = await db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.sessionId, sessionId),
				lt(messages.createdAt, cutoffTime),
			),
		)
		.orderBy(desc(messages.createdAt));

	let totalTokens = 0;
	let compactedTokens = 0;
	const toCompact: Array<{ id: string; content: string }> = [];
	let turns = 0;

	// Go backwards through messages
	for (const msg of oldMessages) {
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
			// Only compact tool_call and tool_result
			if (part.type !== 'tool_call' && part.type !== 'tool_result') continue;

			// Skip protected tools
			if (part.toolName && PROTECTED_TOOLS.includes(part.toolName)) {
				continue;
			}

			// Skip already compacted
			if (part.compactedAt) continue;

			// Parse content
			let content: { result?: unknown; args?: unknown };
			try {
				content = JSON.parse(part.content ?? '{}');
			} catch {
				continue;
			}

			// Estimate tokens
			const contentStr =
				part.type === 'tool_result'
					? typeof content.result === 'string'
						? content.result
						: JSON.stringify(content.result ?? '')
					: JSON.stringify(content.args ?? '');

			const estimate = estimateTokens(contentStr);
			totalTokens += estimate;

			// If we've exceeded the protection threshold, mark for compaction
			if (totalTokens > PRUNE_PROTECT) {
				compactedTokens += estimate;
				toCompact.push({ id: part.id, content: part.content ?? '{}' });
			}
		}
	}

	debugLog(
		`[compaction] Found ${toCompact.length} parts to compact, saving ~${compactedTokens} tokens`,
	);

	if (toCompact.length > 0) {
		const compactedAt = Date.now();

		for (const part of toCompact) {
			try {
				await db
					.update(messageParts)
					.set({ compactedAt })
					.where(eq(messageParts.id, part.id));
			} catch (err) {
				debugLog(
					`[compaction] Failed to mark part ${part.id}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		debugLog(`[compaction] Marked ${toCompact.length} parts as compacted`);
	}

	return { compacted: toCompact.length, saved: compactedTokens };
}

/**
 * Legacy prune function - marks tool results as compacted.
 * Used for automatic overflow-triggered compaction.
 */
export async function pruneSession(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
): Promise<{ pruned: number; saved: number }> {
	debugLog(`[compaction] Auto-pruning session ${sessionId}`);

	const allMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(desc(messages.createdAt));

	let totalTokens = 0;
	let prunedTokens = 0;
	const toPrune: Array<{ id: string }> = [];
	let turns = 0;

	for (const msg of allMessages) {
		if (msg.role === 'user') turns++;
		if (turns < 2) continue;

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(desc(messageParts.index));

		for (const part of parts) {
			if (part.type !== 'tool_result') continue;
			if (part.toolName && PROTECTED_TOOLS.includes(part.toolName)) continue;
			if (part.compactedAt) continue;

			let content: { result?: unknown };
			try {
				content = JSON.parse(part.content ?? '{}');
			} catch {
				continue;
			}

			const estimate = estimateTokens(
				typeof content.result === 'string'
					? content.result
					: JSON.stringify(content.result ?? ''),
			);
			totalTokens += estimate;

			if (totalTokens > PRUNE_PROTECT) {
				prunedTokens += estimate;
				toPrune.push({ id: part.id });
			}
		}
	}

	if (toPrune.length > 0) {
		const compactedAt = Date.now();
		for (const part of toPrune) {
			try {
				await db
					.update(messageParts)
					.set({ compactedAt })
					.where(eq(messageParts.id, part.id));
			} catch {}
		}
	}

	return { pruned: toPrune.length, saved: prunedTokens };
}

/**
 * Check if context is overflowing based on token usage and model limits.
 */
export function isOverflow(tokens: TokenUsage, limits: ModelLimits): boolean {
	if (limits.context === 0) return false;

	const count = tokens.input + (tokens.cacheRead ?? 0) + tokens.output;
	const usableContext = limits.context - limits.output;

	return count > usableContext;
}

/**
 * Get model limits from provider catalog or use defaults.
 */
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

/**
 * Check if a part is compacted.
 */
export function isCompacted(part: { compactedAt?: number | null }): boolean {
	return !!part.compactedAt;
}

export const COMPACTED_PLACEHOLDER = '[Compacted]';

/**
 * Perform auto-compaction when context overflows.
 * Streams the compaction summary (like /compact does), marks old parts as compacted.
 * Returns info needed for caller to trigger a retry.
 * Uses the session's model for consistency with /compact command.
 */
export async function performAutoCompaction(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	assistantMessageId: string,
	publishFn: (event: {
		type: string;
		sessionId: string;
		payload: Record<string, unknown>;
	}) => void,
	provider: string,
	modelId: string,
): Promise<{
	success: boolean;
	summary?: string;
	error?: string;
	compactMessageId?: string;
}> {
	debugLog(`[compaction] Starting auto-compaction for session ${sessionId}`);

	try {
		// 1. Get model limits and build compaction context
		const limits = getModelLimits(provider, modelId);
		// Use 50% of context window for compaction, minimum 15k tokens
		const contextTokenLimit = limits
			? Math.max(Math.floor(limits.context * 0.5), 15000)
			: 15000;
		debugLog(
			`[compaction] Model ${modelId} context limit: ${limits?.context ?? 'unknown'}, using ${contextTokenLimit} tokens for compaction`,
		);

		const context = await buildCompactionContext(
			db,
			sessionId,
			contextTokenLimit,
		);
		if (!context || context.length < 100) {
			debugLog('[compaction] Not enough context to compact');
			return { success: false, error: 'Not enough context to compact' };
		}

		// 2. Stream the compaction summary

		// Use the session's model for consistency
		const cfg = await loadConfig();
		debugLog(
			`[compaction] Using session model ${provider}/${modelId} for auto-compaction`,
		);
		const model = await resolveModel(
			provider as Parameters<typeof resolveModel>[0],
			modelId,
			cfg,
		);

		// Create a text part for the compaction summary (after model created successfully)
		const compactPartId = crypto.randomUUID();
		const now = Date.now();

		await db.insert(messageParts).values({
			id: compactPartId,
			messageId: assistantMessageId,
			index: 0,
			stepIndex: 0,
			type: 'text',
			content: JSON.stringify({ text: '' }),
			agent: 'system',
			provider: provider,
			model: modelId,
			startedAt: now,
		});

		const prompt = getCompactionSystemPrompt();
		const result = streamText({
			model,
			system: `${prompt}\n\nIMPORTANT: Generate a comprehensive summary. This will replace the detailed conversation history.`,
			messages: [
				{
					role: 'user',
					content: `Please summarize this conversation:\n\n<conversation-to-summarize>\n${context}\n</conversation-to-summarize>`,
				},
			],
			maxTokens: 2000,
		});

		// Stream the summary
		let summary = '';
		for await (const chunk of result.textStream) {
			summary += chunk;

			// Publish delta event so UI updates in real-time
			publishFn({
				type: 'message.part.delta',
				sessionId,
				payload: {
					messageId: assistantMessageId,
					partId: compactPartId,
					stepIndex: 0,
					type: 'text',
					delta: chunk,
				},
			});
		}

		// Update the part with final content
		await db
			.update(messageParts)
			.set({
				content: JSON.stringify({ text: summary }),
				completedAt: Date.now(),
			})
			.where(eq(messageParts.id, compactPartId));

		if (!summary || summary.length < 50) {
			debugLog('[compaction] Failed to generate summary');
			return { success: false, error: 'Failed to generate summary' };
		}

		debugLog(`[compaction] Generated summary: ${summary.slice(0, 100)}...`);

		// 3. Mark old parts as compacted (using the assistant message as the cutoff)
		const compactResult = await markSessionCompacted(
			db,
			sessionId,
			assistantMessageId,
		);
		debugLog(
			`[compaction] Marked ${compactResult.compacted} parts as compacted, saved ~${compactResult.saved} tokens`,
		);

		return { success: true, summary, compactMessageId: assistantMessageId };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		debugLog(`[compaction] Auto-compaction failed: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}
}
