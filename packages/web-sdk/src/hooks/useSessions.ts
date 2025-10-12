import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { CreateSessionRequest, UpdateSessionRequest } from '../types/api';

export function useSessions() {
	return useQuery({
		queryKey: ['sessions'],
		queryFn: () => apiClient.getSessions(),
		refetchInterval: 5000,
	});
}

export function useSession(sessionId: string) {
	const { data: sessions } = useSessions();
	return sessions?.find((s) => s.id === sessionId);
}

export function useCreateSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateSessionRequest) => apiClient.createSession(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sessions'] });
		},
	});
}

export function useUpdateSession(sessionId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: UpdateSessionRequest) =>
			apiClient.updateSession(sessionId, data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['sessions'] });
			await queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
		},
	});
}
