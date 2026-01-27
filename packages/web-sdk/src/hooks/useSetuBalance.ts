import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useSetuStore } from '../stores/setuStore';

export function useSetuBalance(providerName: string | undefined) {
	const setBalance = useSetuStore((s) => s.setBalance);
	const setUsdcBalance = useSetuStore((s) => s.setUsdcBalance);
	const setWalletAddress = useSetuStore((s) => s.setWalletAddress);
	const setLoading = useSetuStore((s) => s.setLoading);
	const balance = useSetuStore((s) => s.balance);
	const usdcBalance = useSetuStore((s) => s.usdcBalance);
	const network = useSetuStore((s) => s.network);

	const fetchBalance = useCallback(async () => {
		if (providerName !== 'setu') {
			return;
		}

		setLoading(true);
		try {
			const [setuData, usdcData] = await Promise.all([
				apiClient.getSetuBalance(),
				apiClient.getSetuUsdcBalance(network),
			]);

			if (setuData) {
				setBalance(setuData.balance);
				setWalletAddress(setuData.walletAddress);
			}

			if (usdcData) {
				setUsdcBalance(usdcData.usdcBalance);
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
	]);

	useEffect(() => {
		if (providerName === 'setu' && (balance === null || usdcBalance === null)) {
			fetchBalance();
		}
	}, [providerName, balance, usdcBalance, fetchBalance]);

	return {
		fetchBalance,
	};
}
