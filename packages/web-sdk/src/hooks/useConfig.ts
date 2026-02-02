import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useConfig() {
	return useQuery({
		queryKey: ['config'],
		queryFn: () => apiClient.getConfig(),
		staleTime: 30000,
	});
}

export function useModels(provider?: string) {
	return useQuery({
		queryKey: ['models', provider],
		queryFn: () => (provider ? apiClient.getModels(provider) : null),
		enabled: !!provider,
	});
}

export function useAllModels() {
	return useQuery({
		queryKey: ['models', 'all'],
		queryFn: () => apiClient.getAllModels(),
	});
}

export function useUpdateDefaults() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: {
			agent?: string;
			provider?: string;
			model?: string;
			toolApproval?: 'auto' | 'dangerous' | 'all';
			scope?: 'global' | 'local';
		}) => apiClient.updateDefaults(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['config'] });
		},
	});
}
