import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { ShareStatus } from '../types/api';

export function useShareStatus(sessionId: string | undefined): {
	data: ShareStatus | undefined;
	isLoading: boolean;
	error: Error | null;
} {
	const { data, isLoading, error } = useQuery({
		queryKey: ['share-status', sessionId],
		queryFn: () => apiClient.getShareStatus(sessionId as string),
		enabled: !!sessionId,
		staleTime: 30000,
	});

	return { data, isLoading, error: error as Error | null };
}
