import { config } from './config';
import type {
	Session,
	Message,
	CreateSessionRequest,
	SendMessageRequest,
	SendMessageResponse,
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
		return this.request<Message[]>(
			`/v1/sessions/${sessionId}/messages?parsed=true`,
		);
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
}

export const apiClient = new ApiClient(config.apiBaseUrl);
