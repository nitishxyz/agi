import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { SendMessageRequest } from '../types/api';

export function useMessages(sessionId: string | undefined) {
	return useQuery({
		queryKey: ['messages', sessionId],
		queryFn: () => {
			if (!sessionId) {
				throw new Error('Session ID is required');
			}
			return apiClient.getMessages(sessionId);
		},
		enabled: !!sessionId,
	});
}

export function useSendMessage(sessionId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: SendMessageRequest) =>
			apiClient.sendMessage(sessionId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
			queryClient.invalidateQueries({ queryKey: ['sessions'] });
		},
	});
}
