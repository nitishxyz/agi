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

// Git-related types
export interface GitFileStatus {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
}

export interface GitStatusResponse {
	branch: string;
	ahead: number;
	behind: number;
	staged: GitFileStatus[];
	unstaged: GitFileStatus[];
	untracked: GitFileStatus[];
	hasChanges: boolean;
}

export interface GitDiffResponse {
	file: string;
	diff: string;
	language: string;
	insertions: number;
	deletions: number;
	binary: boolean;
}

export interface GitStageRequest {
	files: string[];
}

export interface GitStageResponse {
	staged: string[];
	failed: string[];
}

export interface GitUnstageRequest {
	files: string[];
}

export interface GitUnstageResponse {
	unstaged: string[];
	failed: string[];
}

export interface GitCommitRequest {
	message: string;
}

export interface GitCommitResponse {
	hash: string;
	message: string;
	filesChanged: number;
	insertions: number;
	deletions: number;
}

export interface GitGenerateCommitMessageResponse {
	message: string;
}

export interface GitBranchInfo {
	current: string;
	upstream: string;
	ahead: number;
	behind: number;
	all: string[];
}

export interface GitPushResponse {
	output: string;
}
