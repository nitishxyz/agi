import { useQuery } from '@tanstack/react-query';
import { useSkillsStore } from '../stores/skillsStore';
import { useEffect } from 'react';
import { apiClient } from '../lib/api-client';

export function useSkills() {
	const setSkills = useSkillsStore((s) => s.setSkills);

	const query = useQuery({
		queryKey: ['skills'],
		queryFn: async () => {
			return apiClient.listSkills();
		},
		refetchInterval: 30000,
	});

	useEffect(() => {
		if (query.data?.skills) {
			setSkills(query.data.skills);
		}
	}, [query.data, setSkills]);

	return query;
}

export function useSkillDetail(name: string | null) {
	return useQuery({
		queryKey: ['skills', name],
		queryFn: async () => {
			if (!name) return null;
			return apiClient.getSkill(name);
		},
		enabled: !!name,
	});
}

export function useSkillFiles(name: string | null) {
	return useQuery({
		queryKey: ['skills', name, 'files'],
		queryFn: async () => {
			if (!name) return null;
			return apiClient.getSkillFiles(name);
		},
		enabled: !!name,
	});
}

export function useSkillFileContent(
	name: string | null,
	filePath: string | null,
) {
	return useQuery({
		queryKey: ['skills', name, 'files', filePath],
		queryFn: async () => {
			if (!name || !filePath) return null;
			return apiClient.getSkillFileContent(name, filePath);
		},
		enabled: !!name && !!filePath,
	});
}
