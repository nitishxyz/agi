import { useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api-client';
import { useUsageStore } from '../stores/usageStore';

const POLL_INTERVAL = 60_000;
const STALE_THRESHOLD = 30_000;

const inflight = new Set<string>();

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

	const isOAuthProvider =
		authType === 'oauth' && (provider === 'anthropic' || provider === 'openai');

	const fetchUsage = useCallback(async () => {
		if (!provider || !isOAuthProvider) return;
		if (inflight.has(provider)) return;

		const last = useUsageStore.getState().lastFetched[provider] ?? 0;
		if (last && Date.now() - last < STALE_THRESHOLD) return;

		inflight.add(provider);
		setLoading(provider, true);
		try {
			const data = await apiClient.getProviderUsage(provider);
			setUsage(provider, data);
			setLastFetched(provider, Date.now());
		} catch {
		} finally {
			setLoading(provider, false);
			inflight.delete(provider);
		}
	}, [provider, isOAuthProvider, setUsage, setLoading, setLastFetched]);

	const fetchRef = useRef(fetchUsage);
	fetchRef.current = fetchUsage;

	useEffect(() => {
		if (!provider || !isOAuthProvider) return;

		fetchRef.current();

		const interval = setInterval(() => fetchRef.current(), POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [isOAuthProvider, provider]);

	return {
		usage,
		fetchUsage,
		isOAuthProvider,
	};
}
