import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useGitStore } from '../stores/gitStore';

export function useGitStatus() {
	const isExpanded = useGitStore((state) => state.isExpanded);

	return useQuery({
		queryKey: ['git', 'status'],
		queryFn: () => apiClient.getGitStatus(),
		// Only poll when sidebar is expanded to reduce unnecessary requests
		refetchInterval: isExpanded ? 5000 : false, // Poll every 5 seconds when expanded
		retry: 1,
		// Keep data fresh but don't spam the server
		staleTime: 3000,
	});
}

export function useGitDiff(file: string | null, staged = false) {
	return useQuery({
		queryKey: ['git', 'diff', file, staged],
		queryFn: () => (file ? apiClient.getGitDiff(file, staged) : null),
		enabled: !!file,
		retry: 1,
		// Don't refetch automatically for diff views
		refetchInterval: false,
	});
}

export function useGitBranch() {
	const isExpanded = useGitStore((state) => state.isExpanded);

	return useQuery({
		queryKey: ['git', 'branch'],
		queryFn: () => apiClient.getGitBranch(),
		// Only poll when sidebar is expanded
		refetchInterval: isExpanded ? 10000 : false, // Poll every 10 seconds
		retry: 1,
		staleTime: 5000,
	});
}

export function useGenerateCommitMessage() {
	return useMutation({
		mutationFn: () => apiClient.generateCommitMessage(),
	});
}

export function useStageFiles() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (files: string[]) => apiClient.stageFiles(files),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
		},
	});
}

export function useUnstageFiles() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (files: string[]) => apiClient.unstageFiles(files),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
		},
	});
}

export function useCommitChanges() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (message: string) => apiClient.commitChanges(message),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
			queryClient.invalidateQueries({ queryKey: ['git', 'branch'] });
		},
	});
}
