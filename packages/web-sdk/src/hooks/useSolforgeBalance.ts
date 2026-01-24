import { useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { useSolforgeStore } from '../stores/solforgeStore';

export function useSolforgeBalance(providerName: string | undefined) {
	const setBalance = useSolforgeStore((s) => s.setBalance);
	const setWalletAddress = useSolforgeStore((s) => s.setWalletAddress);
	const setLoading = useSolforgeStore((s) => s.setLoading);
	const balance = useSolforgeStore((s) => s.balance);

	const fetchBalance = useCallback(async () => {
		if (providerName !== 'solforge') {
			return;
		}

		setLoading(true);
		try {
			const data = await apiClient.getSolforgeBalance();
			if (data) {
				setBalance(data.balance);
				setWalletAddress(data.walletAddress);
			}
		} catch {
		} finally {
			setLoading(false);
		}
	}, [providerName, setBalance, setWalletAddress, setLoading]);

	useEffect(() => {
		if (providerName === 'solforge' && balance === null) {
			fetchBalance();
		}
	}, [providerName, balance, fetchBalance]);

	return {
		fetchBalance,
	};
}
