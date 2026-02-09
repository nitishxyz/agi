import { useState, useEffect, useCallback, useRef } from 'react';
import {
	tauriBridge,
	type GitHubUser,
	type GitHubRepo,
	type DeviceCodeResponse,
} from '../lib/tauri-bridge';

export type OAuthState =
	| { step: 'idle' }
	| { step: 'requesting' }
	| { step: 'awaiting_user'; deviceCode: DeviceCodeResponse }
	| { step: 'polling' }
	| { step: 'complete' }
	| { step: 'error'; message: string };

export function useGitHub() {
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<GitHubUser | null>(null);
	const [repos, setRepos] = useState<GitHubRepo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [oauthState, setOAuthState] = useState<OAuthState>({ step: 'idle' });
	const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopPolling = useCallback(() => {
		if (pollingRef.current) {
			clearInterval(pollingRef.current);
			pollingRef.current = null;
		}
	}, []);

	const loadToken = useCallback(async () => {
		try {
			const savedToken = await tauriBridge.githubGetToken();
			if (savedToken) {
				setToken(savedToken);
				try {
					const userData = await tauriBridge.githubGetUser(savedToken);
					setUser(userData);
				} catch (userErr) {
					console.error('Failed to fetch GitHub user, token may be expired:', userErr);
					setToken(null);
					await tauriBridge.githubLogout().catch(() => {});
				}
			}
		} catch (err) {
			console.error('Failed to load GitHub token:', err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadToken();
		return stopPolling;
	}, [loadToken, stopPolling]);

	const startOAuth = useCallback(async () => {
		try {
			setOAuthState({ step: 'requesting' });
			const deviceCode = await tauriBridge.githubDeviceCodeRequest();
			setOAuthState({ step: 'awaiting_user', deviceCode });
		} catch (err) {
			setOAuthState({
				step: 'error',
				message: err instanceof Error ? err.message : 'Failed to start OAuth',
			});
		}
	}, []);

	const startPolling = useCallback(
		(deviceCode: string, interval: number) => {
			stopPolling();
			setOAuthState({ step: 'polling' });

			pollingRef.current = setInterval(async () => {
				try {
					const result =
						await tauriBridge.githubDeviceCodePoll(deviceCode);

					if (result.status === 'complete' && result.accessToken) {
						stopPolling();
						setToken(result.accessToken);
						const userData = await tauriBridge.githubGetUser(
							result.accessToken,
						);
						setUser(userData);
						setOAuthState({ step: 'complete' });
						setError(null);
					} else if (result.status === 'error') {
						stopPolling();
						setOAuthState({
							step: 'error',
							message: result.error || 'OAuth failed',
						});
					}
				} catch (err) {
					stopPolling();
					setOAuthState({
						step: 'error',
						message:
							err instanceof Error ? err.message : 'Polling failed',
					});
				}
			}, (interval + 1) * 1000);
		},
		[stopPolling],
	);

	const cancelOAuth = useCallback(() => {
		stopPolling();
		setOAuthState({ step: 'idle' });
	}, [stopPolling]);

	const logout = useCallback(async () => {
		try {
			await tauriBridge.githubLogout();
			setToken(null);
			setUser(null);
			setRepos([]);
			setOAuthState({ step: 'idle' });
		} catch (err) {
			console.error('Failed to logout:', err);
		}
	}, []);

	const loadRepos = useCallback(
		async (page?: number, search?: string) => {
			if (!token) return;
			try {
				setLoading(true);
				const repoList = await tauriBridge.githubListRepos(
					token,
					page,
					search,
				);
				if (page && page > 1) {
					setRepos((prev) => [...prev, ...repoList]);
				} else {
					setRepos(repoList);
				}
				return repoList;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'Failed to load repos',
				);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[token],
	);

	const cloneRepo = useCallback(
		async (url: string, path: string): Promise<string> => {
			if (!token) throw new Error('Not authenticated');
			return await tauriBridge.gitClone(url, path, token);
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
		oauthState,
		startOAuth,
		startPolling,
		cancelOAuth,
		logout,
		loadRepos,
		cloneRepo,
	};
}
