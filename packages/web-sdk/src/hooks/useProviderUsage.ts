import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useUsageStore } from '../stores/usageStore';

const POLL_INTERVAL = 60_000;
const STALE_THRESHOLD = 30_000;

export function useProviderUsage(
	provider: string | undefined,
	authType: string | undefined,
) {
	const setUsage = useUsageStore((s) => s.setUsage);
	const setLoading = useUsageStore((s) => s.setLoading);
	const setLastFetched = useUsageStore((s) => s.setLastFetched);
	const usage = useUsageStore((s) =>
		provider ? s.usage[provider] : undefined,
	);
	const lastFetched = useUsageStore((s) =>
		provider ? s.lastFetched[provider] : 0,
	);

	const isOAuthProvider =
		authType === 'oauth' && (provider === 'anthropic' || provider === 'openai');

	const fetchUsage = useCallback(async () => {
		if (!provider || !isOAuthProvider) return;

		setLoading(provider, true);
		try {
			const data = await apiClient.getProviderUsage(provider);
			setUsage(provider, data);
			setLastFetched(provider, Date.now());
		} catch {
		} finally {
			setLoading(provider, false);
		}
	}, [provider, isOAuthProvider, setUsage, setLoading, setLastFetched]);

	useEffect(() => {
		if (!isOAuthProvider) return;

		const isStale = !lastFetched || Date.now() - lastFetched > STALE_THRESHOLD;
		if (isStale) {
			fetchUsage();
		}

		const interval = setInterval(fetchUsage, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [isOAuthProvider, fetchUsage, lastFetched]);

	return {
		usage,
		fetchUsage,
		isOAuthProvider,
	};
}
