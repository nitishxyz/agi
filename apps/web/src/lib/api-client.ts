import { config } from './config';
import type {
	Session,
	Message,
	CreateSessionRequest,
	SendMessageRequest,
	SendMessageResponse,
	GitStatusResponse,
	GitDiffResponse,
	GitStageRequest,
	GitStageResponse,
	GitUnstageRequest,
	GitUnstageResponse,
	GitCommitRequest,
	GitCommitResponse,
	GitGenerateCommitMessageResponse,
	GitBranchInfo,
} from '../types/api';

class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	private async request<T>(
		endpoint: string,
		options?: RequestInit,
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options?.headers,
			},
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `HTTP ${response.status}`);
		}

		return response.json();
	}

	async getSessions(): Promise<Session[]> {
		return this.request<Session[]>('/v1/sessions');
	}

	async createSession(data: CreateSessionRequest): Promise<Session> {
		return this.request<Session>('/v1/sessions', {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	async getMessages(sessionId: string): Promise<Message[]> {
		return this.request<Message[]>(`/v1/sessions/${sessionId}/messages`);
	}

	async sendMessage(
		sessionId: string,
		data: SendMessageRequest,
	): Promise<SendMessageResponse> {
		return this.request<SendMessageResponse>(
			`/v1/sessions/${sessionId}/messages`,
			{
				method: 'POST',
				body: JSON.stringify(data),
			},
		);
	}

	getStreamUrl(sessionId: string): string {
		return `${this.baseUrl}/v1/sessions/${sessionId}/stream`;
	}

	async getConfig(): Promise<{
		agents: string[];
		providers: string[];
		defaults: { agent: string; provider: string; model: string };
	}> {
		return this.request('/v1/config');
	}

	async getModels(provider: string): Promise<{
		models: Array<{ id: string; label: string; toolCall?: boolean }>;
		default: string;
	}> {
		return this.request(`/v1/config/providers/${provider}/models`);
	}

	// Git API methods
	async getGitStatus(): Promise<GitStatusResponse> {
		const response = await this.request<{
			status: string;
			data: GitStatusResponse;
		}>('/v1/git/status');
		return response.data;
	}

	async getGitDiff(file: string, staged = false): Promise<GitDiffResponse> {
		const params = new URLSearchParams({ file, staged: String(staged) });
		const response = await this.request<{
			status: string;
			data: GitDiffResponse;
		}>(`/v1/git/diff?${params}`);
		return response.data;
	}

	async generateCommitMessage(): Promise<GitGenerateCommitMessageResponse> {
		const response = await this.request<{
			status: string;
			data: GitGenerateCommitMessageResponse;
		}>('/v1/git/generate-commit-message', {
			method: 'POST',
			body: JSON.stringify({}),
		});
		return response.data;
	}

	async stageFiles(files: string[]): Promise<GitStageResponse> {
		const response = await this.request<{
			status: string;
			data: GitStageResponse;
		}>('/v1/git/stage', {
			method: 'POST',
			body: JSON.stringify({ files } satisfies GitStageRequest),
		});
		return response.data;
	}

	async unstageFiles(files: string[]): Promise<GitUnstageResponse> {
		const response = await this.request<{
			status: string;
			data: GitUnstageResponse;
		}>('/v1/git/unstage', {
			method: 'POST',
			body: JSON.stringify({ files } satisfies GitUnstageRequest),
		});
		return response.data;
	}

	async commitChanges(message: string): Promise<GitCommitResponse> {
		const response = await this.request<{
			status: string;
			data: GitCommitResponse;
		}>('/v1/git/commit', {
			method: 'POST',
			body: JSON.stringify({ message } satisfies GitCommitRequest),
		});
		return response.data;
	}

	async getGitBranch(): Promise<GitBranchInfo> {
		const response = await this.request<{
			status: string;
			data: GitBranchInfo;
		}>('/v1/git/branch');
		return response.data;
	}
}

export const apiClient = new ApiClient(config.apiBaseUrl);
