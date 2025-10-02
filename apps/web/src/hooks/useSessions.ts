import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { CreateSessionRequest } from '../types/api';

export function useSessions() {
	return useQuery({
		queryKey: ['sessions'],
		queryFn: () => apiClient.getSessions(),
		refetchInterval: 5000,
	});
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
