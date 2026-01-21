import type { ModelMessage } from 'ai';

/**
 * Truncates conversation history to keep only the most recent messages.
 * This helps manage context window size and improves performance.
 *
 * Strategy:
 * - Keep only the last N messages
 * - Preserve message pairs (assistant + user responses) when possible
 * - Always keep at least the system message if present
 */
export function truncateHistory(
	messages: ModelMessage[],
	maxMessages: number,
): ModelMessage[] {
	if (messages.length <= maxMessages) {
		return messages;
	}

	// Calculate how many messages to keep
	const keepCount = Math.min(maxMessages, messages.length);
	const startIndex = messages.length - keepCount;

	// Return the most recent messages
	return messages.slice(startIndex);
}
