export interface SharedSessionData {
	title: string | null;
	username: string;
	agent: string;
	provider: string;
	model: string;
	createdAt: number;
	tokenCount?: number;
	stats?: SessionStats;
	messages: SharedMessage[];
}

export interface SessionStats {
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
	cacheCreationTokens: number;
	reasoningTokens: number;
	toolTimeMs: number;
	toolCounts: Record<string, number>;
}

export interface SharedMessage {
	id: string;
	role: 'user' | 'assistant';
	createdAt: number;
	parts: SharedMessagePart[];
}

export interface SharedMessagePart {
	type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error';
	content: string;
	toolName?: string;
	toolCallId?: string;
}

export interface CreateShareRequest {
	sessionData: SharedSessionData;
	title?: string;
	description?: string;
	lastMessageId: string;
	expiresInDays?: number;
}

export interface UpdateShareRequest {
	sessionData?: SharedSessionData;
	title?: string;
	description?: string;
	lastMessageId?: string;
}
