import type { ModelMessage } from 'ai';

/**
 * Adds cache control to messages for prompt caching optimization.
 * Anthropic supports caching for system messages, tools, and long context.
 */
type CachedSystemValue =
	| string
	| undefined
	| Array<{
			type: 'text';
			text: string;
			cache_control?: { type: 'ephemeral' };
	  }>;

type TextContentPartWithProviderOptions = {
	providerOptions?: {
		anthropic?: { cacheControl?: { type: 'ephemeral' } };
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

export function addCacheControl(
	provider: string,
	system: string | undefined,
	messages: ModelMessage[],
): {
	system?: CachedSystemValue;
	messages: ModelMessage[];
} {
	// Only Anthropic supports prompt caching currently
	if (provider !== 'anthropic') {
		return { system, messages };
	}

	// Convert system to cacheable format if it's long enough
	let cachedSystem: CachedSystemValue = system;
	if (system && system.length > 1024) {
		// Anthropic requires 1024+ tokens for Claude Sonnet/Opus
		cachedSystem = [
			{
				type: 'text',
				text: system,
				cache_control: { type: 'ephemeral' as const },
			},
		];
	}

	// Anthropic cache_control limits:
	// - Max 4 cache blocks total
	// - System message: 1 block
	// - Tools: 2 blocks (read, write)
	// - Last user message: 1 block
	// Total: 4 blocks

	// Add cache control to the last user message if conversation is long
	// This caches the conversation history up to that point
	if (messages.length >= 3) {
		const cachedMessages = [...messages];

		// Find second-to-last user message (not the current one)
		const userIndices = cachedMessages
			.map((m, i) => (m.role === 'user' ? i : -1))
			.filter((i) => i >= 0);

		if (userIndices.length >= 2) {
			const targetIndex = userIndices[userIndices.length - 2];
			const targetMsg = cachedMessages[targetIndex];

			if (Array.isArray(targetMsg.content)) {
				// Add cache control to the last content part of that message
				const lastPart = targetMsg.content[targetMsg.content.length - 1];
				if (
					lastPart &&
					typeof lastPart === 'object' &&
					'type' in lastPart &&
					lastPart.type === 'text'
				) {
					const textPart =
						lastPart as unknown as TextContentPartWithProviderOptions;
					textPart.providerOptions = {
						...textPart.providerOptions,
						anthropic: { cacheControl: { type: 'ephemeral' } },
					};
				}
			}
		}

		return { system: cachedSystem, messages: cachedMessages };
	}

	return { system: cachedSystem, messages };
}

/**
 * Truncates old messages to reduce context size while keeping recent context.
 * Strategy: Keep system message + last N messages
 */
export function truncateHistory(
	messages: ModelMessage[],
	maxMessages = 20,
): ModelMessage[] {
	if (messages.length <= maxMessages) {
		return messages;
	}

	// Keep the most recent messages
	return messages.slice(-maxMessages);
}

/**
 * Estimates token count (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Summarizes tool results if they're too long
 */
export function summarizeToolResult(result: unknown, maxLength = 5000): string {
	const str = typeof result === 'string' ? result : JSON.stringify(result);

	if (str.length <= maxLength) {
		return str;
	}

	// Truncate and add indicator
	return (
		str.slice(0, maxLength) +
		`\n\n[... truncated ${str.length - maxLength} characters]`
	);
}
