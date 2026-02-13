import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useFileTree(dirPath: string, enabled = true) {
	return useQuery({
		queryKey: ['files', 'tree', dirPath],
		queryFn: () => apiClient.getFileTree(dirPath),
		enabled,
		staleTime: 10000,
		retry: 1,
	});
}

export function useFileContent(filePath: string | null) {
	return useQuery({
		queryKey: ['files', 'read', filePath],
		queryFn: () => (filePath ? apiClient.readFileContent(filePath) : null),
		enabled: !!filePath,
		staleTime: 5000,
		retry: 1,
	});
}

export function useGitDiffFullFile(
	file: string | null,
	staged = false,
	enabled = false,
) {
	return useQuery({
		queryKey: ['git', 'diff', 'fullFile', file, staged],
		queryFn: () => (file ? apiClient.getGitDiffFullFile(file, staged) : null),
		enabled: enabled && !!file,
		retry: 1,
		refetchInterval: false,
	});
}
