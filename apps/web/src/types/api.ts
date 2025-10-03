export interface Session {
	id: string;
	title: string | null;
	agent: string;
	provider: string;
	model: string;
	projectPath: string;
	createdAt: number;
	lastActiveAt: number | null;
	totalInputTokens: number | null;
	totalOutputTokens: number | null;
	totalToolTimeMs: number | null;
	toolCounts?: Record<string, number>;
}

export interface Message {
	id: string;
	sessionId: string;
	role: 'system' | 'user' | 'assistant' | 'tool';
	status: 'pending' | 'complete' | 'error';
	agent: string;
	provider: string;
	model: string;
	createdAt: number;
	completedAt: number | null;
	latencyMs: number | null;
	promptTokens: number | null;
	completionTokens: number | null;
	totalTokens: number | null;
	error: string | null;
	parts?: MessagePart[];
}

export interface MessagePart {
	id: string;
	messageId: string;
	index: number;
	stepIndex: number | null;
	type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'error';
	content: string;
	contentJson?: Record<string, unknown>;
	agent: string;
	provider: string;
	model: string;
	startedAt: number | null;
	completedAt: number | null;
	toolName: string | null;
	toolCallId: string | null;
	toolDurationMs: number | null;
	ephemeral?: boolean;
}

export interface SSEEvent {
	type: string;
	payload: Record<string, unknown>;
}

export interface CreateSessionRequest {
	agent?: string;
	provider?: string;
	model?: string;
	title?: string;
}

export interface SendMessageRequest {
	content: string;
	agent?: string;
	provider?: string;
	model?: string;
	oneShot?: boolean;
}

export interface SendMessageResponse {
	messageId: string;
}
