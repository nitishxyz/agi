import { useEffect, useState } from 'react';
import { getWallet, type WalletAccount } from '@/services/wallet';

export function useCurrentWallet() {
	const [wallet, setWallet] = useState<WalletAccount | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function loadWallet() {
			try {
				const stored = await getWallet();
				setWallet(stored);
			} catch (error) {
				console.error('Failed to load wallet:', error);
				setWallet(null);
			} finally {
				setIsLoading(false);
			}
		}

		loadWallet();
	}, []);

	return {
		wallet,
		address: wallet?.publicKey ?? null,
		isLoading,
	};
}
