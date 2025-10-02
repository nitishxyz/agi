import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useConfig() {
	return useQuery({
		queryKey: ['config'],
		queryFn: () => apiClient.getConfig(),
	});
}

export function useModels(provider?: string) {
	return useQuery({
		queryKey: ['models', provider],
		queryFn: () => (provider ? apiClient.getModels(provider) : null),
		enabled: !!provider,
	});
}
