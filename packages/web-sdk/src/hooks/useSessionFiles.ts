import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useSessionFilesStore } from '../stores/sessionFilesStore';

export function useSessionFiles(sessionId: string | undefined) {
	const isExpanded = useSessionFilesStore((state) => state.isExpanded);

	return useQuery({
		queryKey: ['session', sessionId, 'files'],
		queryFn: () => (sessionId ? apiClient.getSessionFiles(sessionId) : null),
		enabled: !!sessionId,
		refetchInterval: isExpanded ? 5000 : false,
		retry: 1,
		staleTime: 3000,
	});
}
