import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useSolforgeStore } from '../stores/solforgeStore';

export function useSolforgeBalance(providerName: string | undefined) {
	const setBalance = useSolforgeStore((s) => s.setBalance);
	const setUsdcBalance = useSolforgeStore((s) => s.setUsdcBalance);
	const setWalletAddress = useSolforgeStore((s) => s.setWalletAddress);
	const setLoading = useSolforgeStore((s) => s.setLoading);
	const balance = useSolforgeStore((s) => s.balance);
	const usdcBalance = useSolforgeStore((s) => s.usdcBalance);
	const network = useSolforgeStore((s) => s.network);

	const fetchBalance = useCallback(async () => {
		if (providerName !== 'solforge') {
			return;
		}

		setLoading(true);
		try {
			const [solforgeData, usdcData] = await Promise.all([
				apiClient.getSolforgeBalance(),
				apiClient.getSolforgeUsdcBalance(network),
			]);

			if (solforgeData) {
				setBalance(solforgeData.balance);
				setWalletAddress(solforgeData.walletAddress);
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
		if (
			providerName === 'solforge' &&
			(balance === null || usdcBalance === null)
		) {
			fetchBalance();
		}
	}, [providerName, balance, usdcBalance, fetchBalance]);

	return {
		fetchBalance,
	};
}
