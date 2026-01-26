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
	totalCachedTokens?: number | null;
	totalCacheCreationTokens?: number | null;
	totalToolTimeMs: number | null;
	toolCounts?: Record<string, number>;
	parentSessionId?: string | null;
	branchPointMessageId?: string | null;
	sessionType?: 'main' | 'branch';
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
	type:
		| 'text'
		| 'tool_call'
		| 'tool_result'
		| 'image'
		| 'file'
		| 'error'
		| 'reasoning';
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

export interface UpdateSessionRequest {
	agent?: string;
	provider?: string;
	model?: string;
}

export interface SendMessageRequest {
	content: string;
	images?: Array<{ data: string; mediaType: string }>;
	files?: Array<{
		type: 'image' | 'pdf' | 'text';
		name: string;
		data: string;
		mediaType: string;
		textContent?: string;
	}>;
	agent?: string;
	provider?: string;
	model?: string;
	oneShot?: boolean;
	userContext?: string;
	reasoning?: boolean;
}

export interface SendMessageResponse {
	messageId: string;
}

export interface ModelInfo {
	id: string;
	label: string;
	toolCall?: boolean;
	reasoning?: boolean;
	vision?: boolean;
}

export interface ProviderModels {
	label: string;
	authType?: 'api' | 'oauth' | 'wallet';
	models: ModelInfo[];
}

export type AllModelsResponse = Record<string, ProviderModels>;

// Git-related types
export interface GitFileStatus {
	path: string;
	absPath: string; // NEW: Absolute filesystem path
	status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
	staged: boolean;
	insertions?: number;
	deletions?: number;
	oldPath?: string; // For renamed files
	isNew: boolean; // NEW: True for untracked or newly added files
}

export interface GitStatusResponse {
	branch: string;
	ahead: number;
	behind: number;
	gitRoot: string; // NEW: Git repository root path
	workingDir: string; // NEW: Current working directory
	staged: GitFileStatus[];
	unstaged: GitFileStatus[];
	untracked: GitFileStatus[];
	hasChanges: boolean;
}

export interface GitDiffResponse {
	file: string;
	absPath: string; // NEW: Absolute filesystem path
	diff: string;
	content?: string; // NEW: Full file content (for new files)
	isNewFile: boolean; // NEW: True if this is a new/untracked file
	language: string;
	insertions: number;
	deletions: number;
	isBinary: boolean; // Renamed from 'binary' for consistency
	staged: boolean; // NEW: Whether showing staged or unstaged version
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

export interface SessionFileOperation {
	path: string;
	operation: 'write' | 'patch' | 'edit' | 'create';
	timestamp: number;
	toolCallId: string;
	toolName: string;
	patch?: string;
	content?: string;
	artifact?: {
		kind: string;
		patch?: string;
		summary?: { additions: number; deletions: number };
	};
}

export interface SessionFile {
	path: string;
	operations: SessionFileOperation[];
	operationCount: number;
	firstModified: number;
	lastModified: number;
}

export interface SessionFilesResponse {
	files: SessionFile[];
	totalFiles: number;
	totalOperations: number;
}

// Session branching types
export interface CreateBranchRequest {
	fromMessageId: string;
	provider?: string;
	model?: string;
	agent?: string;
	title?: string;
}

export interface BranchResult {
	session: Session;
	parentSessionId: string;
	branchPointMessageId: string;
	copiedMessages: number;
	copiedParts: number;
}

export interface BranchInfo {
	session: Session;
	branchPointMessageId: string | null;
	branchPointPreview: string | null;
	createdAt: number;
}

export interface ListBranchesResponse {
	branches: BranchInfo[];
}

export interface ParentSessionResponse {
	parent: Session | null;
}

export interface InjectResearchContextResponse {
	content: string;
	label: string;
	sessionId: string;
	parentSessionId: string;
	tokenEstimate: number;
}

export interface ShareStatus {
	shared: boolean;
	shareId?: string;
	url?: string;
	title?: string | null;
	createdAt?: number;
	lastSyncedAt?: number;
	lastSyncedMessageId?: string;
	syncedMessages?: number;
	totalMessages?: number;
	pendingMessages?: number;
	isSynced?: boolean;
}
