import {
	client,
	listSessions as apiListSessions,
	createSession as apiCreateSession,
	listMessages as apiListMessages,
	createMessage as apiCreateMessage,
	abortSession as apiAbortSession,
	getConfig as apiGetConfig,
	getProviderModels as apiGetProviderModels,
	getGitStatus as apiGetGitStatus,
	getGitDiff as apiGetGitDiff,
	getGitBranch as apiGetGitBranch,
	stageFiles as apiStageFiles,
	unstageFiles as apiUnstageFiles,
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
} from '../types/api';
import { API_BASE_URL } from './config';

interface WindowWithAgiServerUrl extends Window {
	AGI_SERVER_URL?: string;
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
			throw new Error(String(response.error) || 'Failed to fetch sessions');
		}
		return (response.data || []).map(convertSession);
	}

	async createSession(data: CreateSessionRequest): Promise<Session> {
		const response = await apiCreateSession({
			body: data as CreateSessionData['body'],
		});
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to create session');
		}
		if (!response.data) {
			throw new Error('No data returned from create session');
		}
		return convertSession(response.data);
	}

	async abortSession(sessionId: string): Promise<{ success: boolean }> {
		const response = await apiAbortSession({
			path: { sessionId },
		});
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to abort session');
		}
		return response.data as { success: boolean };
	}

	async getMessages(sessionId: string): Promise<Message[]> {
		const response = await apiListMessages({
			path: { id: sessionId },
		});
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to fetch messages');
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
			throw new Error(String(response.error) || 'Failed to send message');
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
			throw new Error(String(response.error) || 'Failed to fetch config');
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
			throw new Error(String(response.error) || 'Failed to fetch models');
		}
		return response.data as {
			models: Array<{ id: string; label: string; toolCall?: boolean }>;
			default: string;
		};
	}

	// Git methods using new API
	async getGitStatus(): Promise<GitStatusResponse> {
		const response = await apiGetGitStatus();
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to fetch git status');
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
			throw new Error(String(response.error) || 'Failed to fetch git diff');
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitDiffResponse;
	}

	async generateCommitMessage(): Promise<GitGenerateCommitMessageResponse> {
		const response = await apiGenerateCommitMessage({
			body: {},
		});
		if (response.error) {
			throw new Error(
				String(response.error) || 'Failed to generate commit message',
			);
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
			throw new Error(String(response.error) || 'Failed to stage files');
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
			throw new Error(String(response.error) || 'Failed to unstage files');
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitUnstageResponse;
	}

	async commitChanges(message: string): Promise<GitCommitResponse> {
		const response = await apiCommitChanges({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch between client and server
			body: { message } as any,
		});
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to commit changes');
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitCommitResponse;
	}

	async getGitBranch(): Promise<GitBranchInfo> {
		const response = await apiGetGitBranch();
		if (response.error) {
			throw new Error(String(response.error) || 'Failed to fetch git branch');
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
			throw new Error(String(response.error) || 'Failed to push commits');
		}
		// biome-ignore lint/suspicious/noExplicitAny: API response structure mismatch
		return (response.data as any)?.data as GitPushResponse;
	}
}

export const apiClient = new ApiClient();
