import { useState, useEffect, useCallback } from 'react';
import {
	tauriBridge,
	type GitHubUser,
	type GitHubRepo,
} from '../lib/tauri-bridge';

export function useGitHub() {
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<GitHubUser | null>(null);
	const [repos, setRepos] = useState<GitHubRepo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadToken = useCallback(async () => {
		try {
			const savedToken = await tauriBridge.githubGetToken();
			if (savedToken) {
				setToken(savedToken);
				const userData = await tauriBridge.githubGetUser(savedToken);
				setUser(userData);
			}
		} catch (err) {
			console.error('Failed to load GitHub token:', err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadToken();
	}, [loadToken]);

	const saveToken = useCallback(async (newToken: string) => {
		try {
			setLoading(true);
			await tauriBridge.githubSaveToken(newToken);
			setToken(newToken);
			const userData = await tauriBridge.githubGetUser(newToken);
			setUser(userData);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save token');
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	const logout = useCallback(async () => {
		try {
			await tauriBridge.githubLogout();
			setToken(null);
			setUser(null);
			setRepos([]);
		} catch (err) {
			console.error('Failed to logout:', err);
		}
	}, []);

	const loadRepos = useCallback(async () => {
		if (!token) return;
		try {
			setLoading(true);
			const repoList = await tauriBridge.githubListRepos(token);
			setRepos(repoList);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load repos');
		} finally {
			setLoading(false);
		}
	}, [token]);

	const cloneRepo = useCallback(
		async (url: string, path: string) => {
			if (!token) throw new Error('Not authenticated');
			await tauriBridge.gitClone(url, path, token);
		},
		[token],
	);

	return {
		token,
		user,
		repos,
		loading,
		error,
		isAuthenticated: !!token && !!user,
		saveToken,
		logout,
		loadRepos,
		cloneRepo,
	};
}
