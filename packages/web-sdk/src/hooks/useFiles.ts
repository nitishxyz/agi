import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useFiles() {
	return useQuery({
		queryKey: ['files'],
		queryFn: async () => {
			const result = await apiClient.listFiles();
			return result;
		},
		staleTime: 60000,
		retry: 1,
	});
}
