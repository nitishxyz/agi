import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useOttoRouterStore } from '../stores/ottorouterStore';
import { useUsageStore } from '../stores/usageStore';

export function useOttoRouterBalance(providerName: string | undefined) {
	const setBalance = useOttoRouterStore((s) => s.setBalance);
	const setUsdcBalance = useOttoRouterStore((s) => s.setUsdcBalance);
	const setWalletAddress = useOttoRouterStore((s) => s.setWalletAddress);
	const setLoading = useOttoRouterStore((s) => s.setLoading);
	const setScope = useOttoRouterStore((s) => s.setScope);
	const setPayg = useOttoRouterStore((s) => s.setPayg);
	const setSubscription = useOttoRouterStore((s) => s.setSubscription);
	const setLimits = useOttoRouterStore((s) => s.setLimits);
	const setUsage = useUsageStore((s) => s.setUsage);
	const balance = useOttoRouterStore((s) => s.balance);
	const usdcBalance = useOttoRouterStore((s) => s.usdcBalance);
	const subscription = useOttoRouterStore((s) => s.subscription);
	const network = useOttoRouterStore((s) => s.network);

	const fetchBalance = useCallback(async () => {
		if (providerName !== 'ottorouter') {
			return;
		}

		setLoading(true);
		try {
			const [setuData, usdcData, walletData] = await Promise.all([
				apiClient.getOttoRouterBalance(),
				apiClient.getOttoRouterUsdcBalance(network),
				apiClient.getOttoRouterWallet(),
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
					setUsage('ottorouter', {
						provider: 'ottorouter',
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

	const needsUsageWindows = subscription?.active && !subscription.usageWindows;

	useEffect(() => {
		if (
			providerName === 'ottorouter' &&
			(balance === null || usdcBalance === null || needsUsageWindows)
		) {
			fetchBalance();
		}
	}, [providerName, balance, usdcBalance, needsUsageWindows, fetchBalance]);

	return {
		fetchBalance,
	};
}
