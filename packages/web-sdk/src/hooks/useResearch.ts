import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/config';
import { usePendingResearchStore } from '../stores/pendingResearchStore';

export interface ResearchSession {
	id: string;
	title: string | null;
	createdAt: number;
	lastActiveAt: number | null;
	provider: string;
	model: string;
	messageCount: number;
}

export interface ResearchSessionsResponse {
	sessions: ResearchSession[];
}

export interface CreateResearchResponse {
	session: ResearchSession;
	parentSessionId: string;
}

export interface InjectContextResponse {
	content: string;
	label: string;
	sessionId: string;
	parentSessionId: string;
	tokenEstimate: number;
}

export interface ExportToSessionResponse {
	newSession: {
		id: string;
		title: string | null;
		agent: string;
		provider: string;
		model: string;
	};
	injectedContext: string;
}

class ResearchApiClient {
	private get baseUrl(): string {
		// Check for runtime injected URL first
		const win = window as Window & { AGI_SERVER_URL?: string };
		if (win.AGI_SERVER_URL) {
			return win.AGI_SERVER_URL;
		}
		// Check for Vite env var
		if (import.meta.env?.VITE_API_BASE_URL) {
			return import.meta.env.VITE_API_BASE_URL;
		}
		return API_BASE_URL;
	}

	async listResearchSessions(
		parentSessionId: string,
	): Promise<ResearchSessionsResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${parentSessionId}/research`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			},
		);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Failed to fetch research sessions' }));
			throw new Error(error.error || 'Failed to fetch research sessions');
		}

		return response.json();
	}

	async createResearchSession(
		parentSessionId: string,
		data: { provider?: string; model?: string; title?: string },
	): Promise<CreateResearchResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${parentSessionId}/research`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			},
		);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Failed to create research session' }));
			throw new Error(error.error || 'Failed to create research session');
		}

		return response.json();
	}

	async deleteResearchSession(
		researchId: string,
	): Promise<{ success: boolean }> {
		const response = await fetch(`${this.baseUrl}/v1/research/${researchId}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Failed to delete research session' }));
			throw new Error(error.error || 'Failed to delete research session');
		}

		return response.json();
	}

	async injectContext(
		parentSessionId: string,
		researchSessionId: string,
		label?: string,
	): Promise<InjectContextResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/sessions/${parentSessionId}/inject`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ researchSessionId, label }),
			},
		);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Failed to inject context' }));
			throw new Error(error.error || 'Failed to inject context');
		}

		return response.json();
	}

	async exportToNewSession(
		researchId: string,
		data?: { provider?: string; model?: string; agent?: string },
	): Promise<ExportToSessionResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1/research/${researchId}/export`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data ?? {}),
			},
		);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: 'Failed to export to session' }));
			throw new Error(error.error || 'Failed to export to session');
		}

		return response.json();
	}
}

const researchApi = new ResearchApiClient();

export function useResearchSessions(parentSessionId: string | null) {
	return useQuery({
		queryKey: ['research', 'sessions', parentSessionId],
		queryFn: () => researchApi.listResearchSessions(parentSessionId!),
		enabled: !!parentSessionId,
		staleTime: 30000,
	});
}

export function useCreateResearchSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			parentSessionId,
			data,
		}: {
			parentSessionId: string;
			data?: { provider?: string; model?: string; title?: string };
		}) => researchApi.createResearchSession(parentSessionId, data ?? {}),
		onSuccess: (_, { parentSessionId }) => {
			queryClient.invalidateQueries({
				queryKey: ['research', 'sessions', parentSessionId],
			});
		},
	});
}

export function useDeleteResearchSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (researchId: string) =>
			researchApi.deleteResearchSession(researchId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['research', 'sessions'] });
		},
	});
}

export function useInjectContext() {
	const addContext = usePendingResearchStore((state) => state.addContext);

	return useMutation({
		mutationFn: ({
			parentSessionId,
			researchSessionId,
			label,
		}: {
			parentSessionId: string;
			researchSessionId: string;
			label?: string;
		}) => researchApi.injectContext(parentSessionId, researchSessionId, label),
		onSuccess: (data, { parentSessionId }) => {
			addContext(parentSessionId, {
				id: data.sessionId,
				sessionId: data.sessionId,
				label: data.label,
				content: data.content,
			});
		},
	});
}

export function useExportToSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			researchId,
			data,
		}: {
			researchId: string;
			data?: { provider?: string; model?: string; agent?: string };
		}) => researchApi.exportToNewSession(researchId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sessions'] });
		},
	});
}
