import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { CreateBranchRequest } from '../types/api';

export function useCreateBranch(sessionId: string | undefined) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateBranchRequest) => {
			if (!sessionId) throw new Error('No session ID');
			return apiClient.createBranch(sessionId, data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sessions'] });
			if (sessionId) {
				queryClient.invalidateQueries({
					queryKey: ['branches', sessionId],
				});
			}
		},
	});
}

export function useBranches(sessionId: string | undefined) {
	return useQuery({
		queryKey: ['branches', sessionId],
		queryFn: () => {
			if (!sessionId) throw new Error('No session ID');
			return apiClient.listBranches(sessionId);
		},
		enabled: Boolean(sessionId),
	});
}

export function useParentSession(sessionId: string | undefined) {
	return useQuery({
		queryKey: ['parentSession', sessionId],
		queryFn: () => {
			if (!sessionId) throw new Error('No session ID');
			return apiClient.getParentSession(sessionId);
		},
		enabled: Boolean(sessionId),
	});
}
