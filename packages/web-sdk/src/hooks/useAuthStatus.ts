import { useEffect, useCallback, useState } from 'react';
import { apiClient } from '../lib/api-client';
import { useOnboardingStore, type AuthStatus } from '../stores/onboardingStore';

export function useAuthStatus() {
	const setAuthStatus = useOnboardingStore((s) => s.setAuthStatus);
	const setOpen = useOnboardingStore((s) => s.setOpen);
	const setLoading = useOnboardingStore((s) => s.setLoading);
	const setError = useOnboardingStore((s) => s.setError);
	const authStatus = useOnboardingStore((s) => s.authStatus);
	const isOpen = useOnboardingStore((s) => s.isOpen);

	const [initialized, setInitialized] = useState(false);

	const fetchAuthStatus = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const status = await apiClient.getAuthStatus();
			setAuthStatus(status);
			return status;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load';
			setError(message);
			return null;
		} finally {
			setLoading(false);
		}
	}, [setAuthStatus, setLoading, setError]);

	const checkOnboarding = useCallback(async () => {
		const status = await fetchAuthStatus();
		if (status && !status.onboardingComplete) {
			setOpen(true);
		}
		setInitialized(true);
	}, [fetchAuthStatus, setOpen]);

	const setupWallet = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await apiClient.setupSetuWallet();
			await fetchAuthStatus();
			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Setup failed';
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	}, [fetchAuthStatus, setLoading, setError]);

	const importWallet = useCallback(
		async (privateKey: string) => {
			setLoading(true);
			setError(null);
			try {
				const result = await apiClient.importSetuWallet(privateKey);
				await fetchAuthStatus();
				return result;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Import failed';
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchAuthStatus, setLoading, setError],
	);

	const addProvider = useCallback(
		async (provider: string, apiKey: string) => {
			setLoading(true);
			setError(null);
			try {
				const result = await apiClient.addProvider(provider, apiKey);
				await fetchAuthStatus();
				return result;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to add provider';
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchAuthStatus, setLoading, setError],
	);

	const removeProvider = useCallback(
		async (provider: string) => {
			setLoading(true);
			setError(null);
			try {
				const result = await apiClient.removeProvider(provider);
				await fetchAuthStatus();
				return result;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to remove provider';
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchAuthStatus, setLoading, setError],
	);

	const completeOnboarding = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			await apiClient.completeOnboarding();
			await fetchAuthStatus();
			setOpen(false);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to complete onboarding';
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	}, [fetchAuthStatus, setLoading, setError, setOpen]);

	const startOAuth = useCallback((provider: string, mode?: string) => {
		const url = apiClient.getOAuthStartUrl(provider, mode);
		const width = 600;
		const height = 700;
		const left = window.screenX + (window.outerWidth - width) / 2;
		const top = window.screenY + (window.outerHeight - height) / 2;
		const popup = window.open(
			url,
			'oauth_popup',
			`width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
		);
		return popup;
	}, []);

	const startOAuthManual = useCallback(
		async (provider: string, mode?: string) => {
			// Open popup immediately to avoid browser blocking
			const width = 600;
			const height = 700;
			const left = window.screenX + (window.outerWidth - width) / 2;
			const top = window.screenY + (window.outerHeight - height) / 2;
			const popup = window.open(
				'about:blank',
				'oauth_popup',
				`width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
			);

			const { url, sessionId } = await apiClient.getOAuthUrl(provider, mode);

			// Navigate popup to OAuth URL
			if (popup) {
				popup.location.href = url;
			}

			return { popup, sessionId };
		},
		[],
	);

	const exchangeOAuthCode = useCallback(
		async (provider: string, code: string, sessionId: string) => {
			setLoading(true);
			setError(null);
			try {
				await apiClient.exchangeOAuthCode(provider, code, sessionId);
				await fetchAuthStatus();
				return true;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to exchange code';
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchAuthStatus, setLoading, setError],
	);

	useEffect(() => {
		const handleOAuthMessage = (event: MessageEvent) => {
			if (event.data?.type === 'oauth-success') {
				fetchAuthStatus();
			}
		};

		window.addEventListener('message', handleOAuthMessage);
		return () => window.removeEventListener('message', handleOAuthMessage);
	}, [fetchAuthStatus]);

	return {
		authStatus,
		isOpen,
		initialized,
		fetchAuthStatus,
		checkOnboarding,
		setupWallet,
		importWallet,
		addProvider,
		removeProvider,
		completeOnboarding,
		startOAuth,
		startOAuthManual,
		exchangeOAuthCode,
	};
}
