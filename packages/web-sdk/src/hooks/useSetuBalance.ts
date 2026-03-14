import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useSetuStore } from '../stores/setuStore';
import { useUsageStore } from '../stores/usageStore';

export function useSetuBalance(providerName: string | undefined) {
	const setBalance = useSetuStore((s) => s.setBalance);
	const setUsdcBalance = useSetuStore((s) => s.setUsdcBalance);
	const setWalletAddress = useSetuStore((s) => s.setWalletAddress);
	const setLoading = useSetuStore((s) => s.setLoading);
	const setScope = useSetuStore((s) => s.setScope);
	const setPayg = useSetuStore((s) => s.setPayg);
	const setSubscription = useSetuStore((s) => s.setSubscription);
	const setLimits = useSetuStore((s) => s.setLimits);
	const setUsage = useUsageStore((s) => s.setUsage);
	const balance = useSetuStore((s) => s.balance);
	const usdcBalance = useSetuStore((s) => s.usdcBalance);
	const subscription = useSetuStore((s) => s.subscription);
	const network = useSetuStore((s) => s.network);

	const fetchBalance = useCallback(async () => {
		if (providerName !== 'setu') {
			return;
		}

		setLoading(true);
		try {
			const [setuData, usdcData, walletData] = await Promise.all([
				apiClient.getSetuBalance(),
				apiClient.getSetuUsdcBalance(network),
				apiClient.getSetuWallet(),
			]);

			if (setuData) {
				setBalance(setuData.balance);
				setWalletAddress(setuData.walletAddress);
				setScope(setuData.scope ?? null);
				setPayg(setuData.payg ?? null);
				setSubscription(setuData.subscription ?? null);
				setLimits(setuData.limits ?? null);

				const sub = setuData.subscription;
				if (sub?.active && sub.usageWindows) {
					setUsage('setu', {
						provider: 'setu',
						primaryWindow: {
							usedPercent: sub.usageWindows.fiveHour.percentUsed,
							windowSeconds: 18000,
							resetsAt: null,
						},
						secondaryWindow: {
							usedPercent: sub.usageWindows.weekly.percentUsed,
							windowSeconds: 604800,
							resetsAt: null,
						},
						limitReached: false,
						planType: sub.tierName ?? 'GO',
					});
				}
			} else if (walletData?.configured && walletData.publicKey) {
				setWalletAddress(walletData.publicKey);
			}

			if (usdcData) {
				setUsdcBalance(usdcData.usdcBalance);
				if (!setuData && usdcData.walletAddress) {
					setWalletAddress(usdcData.walletAddress);
				}
			}
		} catch {
		} finally {
			setLoading(false);
		}
	}, [
		providerName,
		network,
		setBalance,
		setUsdcBalance,
		setWalletAddress,
		setLoading,
		setScope,
		setPayg,
		setSubscription,
		setLimits,
		setUsage,
	]);

	const needsUsageWindows =
		subscription?.active && !subscription.usageWindows;

	useEffect(() => {
		if (
			providerName === 'setu' &&
			(balance === null || usdcBalance === null || needsUsageWindows)
		) {
			fetchBalance();
		}
	}, [providerName, balance, usdcBalance, needsUsageWindows, fetchBalance]);

	return {
		fetchBalance,
	};
}
