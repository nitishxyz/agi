export function extractReplayText(
	parts: Array<{ type: string; content: string }>,
): string {
	const chunks: string[] = [];
	for (const part of parts) {
		if (part.type !== 'text') continue;
		try {
			const parsed = JSON.parse(part.content) as { text?: unknown };
			const text = typeof parsed.text === 'string' ? parsed.text : '';
			if (text) chunks.push(text);
		} catch {
			if (part.content) chunks.push(part.content);
		}
	}
	return chunks.join('\n');
}

export function parseReplayImage(
	content: string,
): { data: string; mediaType: string } | null {
	try {
		const parsed = JSON.parse(content) as {
			data?: unknown;
			mediaType?: unknown;
		};
		if (typeof parsed.data !== 'string') return null;
		if (typeof parsed.mediaType !== 'string') return null;
		return { data: parsed.data, mediaType: parsed.mediaType };
	} catch {
		return null;
	}
}

export function parseReplayToolCall(part: {
	content: string;
	toolName?: string | null;
	toolCallId?: string | null;
}): {
	name: string;
	callId: string;
	args: Record<string, unknown> | undefined;
} | null {
	try {
		const parsed = JSON.parse(part.content) as {
			name?: unknown;
			callId?: unknown;
			args?: unknown;
		};
		const name =
			typeof parsed.name === 'string'
				? parsed.name
				: typeof part.toolName === 'string'
					? part.toolName
					: undefined;
		const callId =
			typeof parsed.callId === 'string'
				? parsed.callId
				: typeof part.toolCallId === 'string'
					? part.toolCallId
					: undefined;
		if (!name || !callId) return null;
		const args =
			parsed.args && typeof parsed.args === 'object'
				? (parsed.args as Record<string, unknown>)
				: undefined;
		return { name, callId, args };
	} catch {
		return null;
	}
}

export function parseReplayToolResult(part: {
	content: string;
	toolName?: string | null;
	toolCallId?: string | null;
}): { name: string; callId: string; result: unknown } | null {
	try {
		const parsed = JSON.parse(part.content) as {
			name?: unknown;
			callId?: unknown;
			result?: unknown;
		};
		const name =
			typeof parsed.name === 'string'
				? parsed.name
				: typeof part.toolName === 'string'
					? part.toolName
					: undefined;
		const callId =
			typeof parsed.callId === 'string'
				? parsed.callId
				: typeof part.toolCallId === 'string'
					? part.toolCallId
					: undefined;
		if (!name || !callId) return null;
		return { name, callId, result: parsed.result };
	} catch {
		return null;
	}
}
