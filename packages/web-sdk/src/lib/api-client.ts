import {
	client,
	listSessions as apiListSessions,
	createSession as apiCreateSession,
	listMessages as apiListMessages,
	createMessage as apiCreateMessage,
	abortSession as apiAbortSession,
	getConfig as apiGetConfig,
	getProviderModels as apiGetProviderModels,
	listFiles as apiListFiles,
	getGitStatus as apiGetGitStatus,
	getGitDiff as apiGetGitDiff,
	getGitBranch as apiGetGitBranch,
	stageFiles as apiStageFiles,
	unstageFiles as apiUnstageFiles,
	restoreFiles as apiRestoreFiles,
	deleteFiles as apiDeleteFiles,
	commitChanges as apiCommitChanges,
	generateCommitMessage as apiGenerateCommitMessage,
	pushCommits as apiPushCommits,
	type Session as ApiSession,
	type Message as ApiMessage,
	type CreateSessionData,
	type CreateMessageData,
} from '@agi-cli/api';
import type {
	Session,
	Message,
	CreateSessionRequest,
	SendMessageRequest,
	SendMessageResponse,
	GitStatusResponse,
	GitDiffResponse,
	GitStageResponse,
	GitUnstageResponse,
	GitCommitResponse,
	GitGenerateCommitMessageResponse,
	GitBranchInfo,
	GitPushResponse,
	UpdateSessionRequest,
	AllModelsResponse,
	SessionFilesResponse,
	CreateBranchRequest,
	BranchResult,
	ListBranchesResponse,
	ParentSessionResponse,
	ShareStatus,
} from '../types/api';
import { API_BASE_URL } from './config';

interface WindowWithAgiServerUrl extends Window {
	AGI_SERVER_URL?: string;
}

/**
 * Extract error message from API error response
 * Handles both string errors and structured error objects
 */
function extractErrorMessage(error: unknown): string {
	if (!error) {
		return 'Unknown error';
	}

	// If it's a string, return it
	if (typeof error === 'string') {
		return error;
	}

	// If it's an error object with our standardized structure
	if (error && typeof error === 'object') {
		const errObj = error as Record<string, unknown>;

		// New standardized format: { error: { message, type, ... } }
		if (errObj.error && typeof errObj.error === 'object') {
			const innerError = errObj.error as Record<string, unknown>;
			if (typeof innerError.message === 'string') {
				return innerError.message;
			}
		}

		// Legacy format: { error: "message" }
		if (typeof errObj.error === 'string') {
			return errObj.error;
		}

		// Direct message property
		if (typeof errObj.message === 'string') {
			return errObj.message;
		}

		// Try to JSON stringify if it's a complex object
		try {
			return JSON.stringify(error);
		} catch {
			return 'Error occurred (unable to parse)';
		}
	}

	return 'Unknown error';
}

/**
 * Configure the API client with the correct base URL
 * This should be called once at application startup
 */
export function configureApiClient() {
	const win = window as WindowWithAgiServerUrl;
	const baseURL = win.AGI_SERVER_URL || API_BASE_URL;

	client.setConfig({
		baseURL,
	});
}

// Configure the client immediately when this module is imported
configureApiClient();

// Type conversion helpers
function convertSession(apiSession: ApiSession): Session {
	return {
		...apiSession,
		title: apiSession.title ?? null,
		createdAt:
			typeof apiSession.createdAt === 'string'
				? new Date(apiSession.createdAt).getTime()
				: apiSession.createdAt,
		lastActiveAt:
			typeof apiSession.lastActiveAt === 'string'
				? new Date(apiSession.lastActiveAt).getTime()
				: apiSession.lastActiveAt,
	} as Session;
}

function convertMessage(apiMessage: ApiMessage): Message {
	return {
		...apiMessage,
		createdAt:
			typeof apiMessage.createdAt === 'string'
				? new Date(apiMessage.createdAt).getTime()
				: apiMessage.createdAt,
		completedAt: apiMessage.completedAt
			? typeof apiMessage.completedAt === 'string'
				? new Date(apiMessage.completedAt).getTime()
				: apiMessage.completedAt
			: null,
	} as Message;
}

class ApiClient {
	private get baseUrl(): string {
		// Always check for injected URL at runtime
		const win = window as WindowWithAgiServerUrl;
		if (win.AGI_SERVER_URL) {
			return win.AGI_SERVER_URL;
		}
		return API_BASE_URL;
	}

	// Session methods using new API
	async getSessions(): Promise<Session[]> {
		const response = await apiListSessions();
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return (response.data || []).map(convertSession);
	}

	async createSession(data: CreateSessionRequest): Promise<Session> {
		const response = await apiCreateSession({
			body: data as CreateSessionData['body'],
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		if (!response.data) {
			throw new Error('No data returned from create session');
		}
		return convertSession(response.data);
	}

	async updateSession(
		sessionId: string,
		data: UpdateSessionRequest,
	): Promise<Session> {
		const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to update session' }));
			throw new Error(extractErrorMessage(errorData));
		}

		const sessionData = await response.json();
		return convertSession(sessionData);
	}

	async deleteSession(sessionId: string): Promise<{ success: boolean }> {
		const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to delete session' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async abortSession(sessionId: string): Promise<{ success: boolean }> {
		const response = await apiAbortSession({
			path: { sessionId },
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return response.data as { success: boolean };
	}

	async abortMessage(
		sessionId: string,
		messageId: string,
	): Promise<{ success: boolean; wasRunning: boolean; messageId: string }> {
		const baseUrl = this.baseUrl;
		const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/abort`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId }),
		});
		if (!response.ok) {
			throw new Error('Failed to abort message');
		}
		return response.json();
	}

	async getQueueState(sessionId: string): Promise<{
		currentMessageId: string | null;
		queuedMessages: Array<{ messageId: string; position: number }>;
		isRunning: boolean;
	}> {
		const baseUrl = this.baseUrl;
		const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/queue`);
		if (!response.ok) {
			throw new Error('Failed to get queue state');
		}
		return response.json();
	}

	async removeFromQueue(
		sessionId: string,
		messageId: string,
	): Promise<{
		success: boolean;
		removed: boolean;
		wasQueued?: boolean;
		wasRunning?: boolean;
	}> {
		const baseUrl = this.baseUrl;
		const response = await fetch(
			`${baseUrl}/v1/sessions/${sessionId}/queue/${messageId}`,
			{ method: 'DELETE' },
		);
		if (!response.ok) {
			throw new Error('Failed to remove from queue');
		}
		return response.json();
	}

	async getMessages(sessionId: string): Promise<Message[]> {
		const response = await apiListMessages({
			path: { id: sessionId },
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return (response.data || []).map(convertMessage);
	}

	async sendMessage(
		sessionId: string,
		data: SendMessageRequest,
	): Promise<SendMessageResponse> {
		const response = await apiCreateMessage({
			path: { id: sessionId },
			body: data as CreateMessageData['body'],
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return response.data as SendMessageResponse;
	}

	getStreamUrl(sessionId: string): string {
		return `${this.baseUrl}/v1/sessions/${sessionId}/stream`;
	}

	// Config methods using new API
	async getConfig(): Promise<{
		agents: string[];
		providers: string[];
		defaults: { agent: string; provider: string; model: string };
	}> {
		const response = await apiGetConfig();
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return response.data as {
			agents: string[];
			providers: string[];
			defaults: { agent: string; provider: string; model: string };
		};
	}

	async getModels(providerId: string): Promise<{
		models: Array<{ id: string; label: string; toolCall?: boolean }>;
		default: string;
	}> {
		const response = await apiGetProviderModels({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			path: { provider: providerId as any },
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return response.data as {
			models: Array<{ id: string; label: string; toolCall?: boolean }>;
			default: string;
		};
	}

	async getAllModels(): Promise<AllModelsResponse> {
		const response = await fetch(`${this.baseUrl}/v1/config/models`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to fetch models' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async updateDefaults(data: {
		agent?: string;
		provider?: string;
		model?: string;
		scope?: 'global' | 'local';
	}): Promise<{
		success: boolean;
		defaults: { agent: string; provider: string; model: string };
	}> {
		const response = await fetch(`${this.baseUrl}/v1/config/defaults`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to update defaults' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	// Git methods using new API
	async getGitStatus(): Promise<GitStatusResponse> {
		const response = await apiGetGitStatus();
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitStatusResponse;
	}

	async getGitDiff(
		file: string,
		staged: boolean = false,
	): Promise<GitDiffResponse> {
		const response = await apiGetGitDiff({
			query: {
				file,
				staged: staged ? 'true' : 'false',
			},
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitDiffResponse;
	}

	async generateCommitMessage(
		sessionId?: string,
	): Promise<GitGenerateCommitMessageResponse> {
		const response = await apiGenerateCommitMessage({
			body: sessionId ? { sessionId } : {},
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitGenerateCommitMessageResponse;
	}

	async stageFiles(files: string[]): Promise<GitStageResponse> {
		const response = await apiStageFiles({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { files } as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitStageResponse;
	}

	async unstageFiles(files: string[]): Promise<GitUnstageResponse> {
		const response = await apiUnstageFiles({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { files } as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitUnstageResponse;
	}

	async restoreFiles(files: string[]): Promise<{ restored: string[] }> {
		const response = await apiRestoreFiles({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { files } as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as { restored: string[] };
	}

	async deleteFiles(files: string[]): Promise<{ deleted: string[] }> {
		const response = await apiDeleteFiles({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { files } as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as { deleted: string[] };
	}

	async commitChanges(message: string): Promise<GitCommitResponse> {
		const response = await apiCommitChanges({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { message } as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitCommitResponse;
	}

	async getGitBranch(): Promise<GitBranchInfo> {
		const response = await apiGetGitBranch();
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitBranchInfo;
	}

	async pushCommits(): Promise<GitPushResponse> {
		const response = await apiPushCommits({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: {} as any,
		});
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitPushResponse;
	}

	async listFiles() {
		const response = await apiListFiles();
		if (response.error) {
			throw new Error(extractErrorMessage(response.error));
		}
		return response.data as {
			files: string[];
			changedFiles: Array<{ path: string; status: string }>;
			truncated: boolean;
		};
	}

	async getSessionFiles(sessionId: string): Promise<SessionFilesResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${sessionId}/files`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to fetch session files' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async createBranch(
		sessionId: string,
		data: CreateBranchRequest,
	): Promise<BranchResult> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${sessionId}/branch`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			},
		);

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to create branch' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async listBranches(sessionId: string): Promise<ListBranchesResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${sessionId}/branches`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to list branches' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async getParentSession(sessionId: string): Promise<ParentSessionResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${sessionId}/parent`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ error: 'Failed to get parent session' }));
			throw new Error(extractErrorMessage(errorData));
		}

		return await response.json();
	}

	async getSolforgeBalance(): Promise<{
		walletAddress: string;
		balance: number;
		totalSpent: number;
		totalTopups: number;
		requestCount: number;
	} | null> {
		try {
			const response = await fetch(`${this.baseUrl}/v1/solforge/balance`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch {
			return null;
		}
	}

	async getSolforgeWallet(): Promise<{
		configured: boolean;
		publicKey?: string;
		error?: string;
	}> {
		try {
			const response = await fetch(`${this.baseUrl}/v1/solforge/wallet`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				return { configured: false };
			}

			return await response.json();
		} catch {
			return { configured: false };
		}
	}

	async getSolforgeUsdcBalance(
		network: 'mainnet' | 'devnet' = 'mainnet',
	): Promise<{
		walletAddress: string;
		usdcBalance: number;
		network: 'mainnet' | 'devnet';
	} | null> {
		try {
			const response = await fetch(
				`${this.baseUrl}/v1/solforge/usdc-balance?network=${network}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				},
			);

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch {
			return null;
		}
	}

	async getShareStatus(sessionId: string): Promise<ShareStatus> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${sessionId}/share`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.ok) {
			return { shared: false };
		}

		return await response.json();
	}
}

export const apiClient = new ApiClient();
