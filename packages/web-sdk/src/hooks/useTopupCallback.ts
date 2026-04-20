import { useEffect, useRef } from 'react';
import { useToastStore, toast } from '../stores/toastStore';
import { useOttoRouterStore } from '../stores/ottorouterStore';
import { apiClient } from '../lib/api-client';

const STORAGE_KEY = 'pendingPolarCheckout';

export function useTopupCallback() {
	const hasHandled = useRef(false);
	const loadingToastId = useRef<string | null>(null);
	const setBalance = useOttoRouterStore((s) => s.setBalance);
	const removeToast = useToastStore((s) => s.removeToast);

	useEffect(() => {
		if (hasHandled.current) return;

		const params = new URLSearchParams(window.location.search);
		const topupStatus = params.get('topup');

		const pendingCheckoutId = localStorage.getItem(STORAGE_KEY);

		if (topupStatus === 'pending' || pendingCheckoutId) {
			hasHandled.current = true;

			const url = new URL(window.location.href);
			url.searchParams.delete('topup');
			window.history.replaceState({}, '', url.toString());

			if (!pendingCheckoutId) {
				toast.info('Checking top-up status...');
				return;
			}

			loadingToastId.current = toast.loading('Verifying top-up...');

			let attempts = 0;
			const maxAttempts = 10;
			const delayMs = 2000;

			const dismissLoading = () => {
				if (loadingToastId.current) {
					removeToast(loadingToastId.current);
					loadingToastId.current = null;
				}
			};

			const checkStatus = async () => {
				attempts++;
				try {
					const status = await apiClient.getPolarTopupStatus(pendingCheckoutId);

					if (status?.confirmed) {
						localStorage.removeItem(STORAGE_KEY);
						dismissLoading();

						const balanceData = await apiClient.getOttoRouterBalance();
						if (balanceData?.balance !== undefined) {
							setBalance(balanceData.balance);
						}

						toast.success(
							`Top-up confirmed! +$${status.amountUsd?.toFixed(2)} credited`,
						);
						return;
					}

					if (attempts < maxAttempts) {
						setTimeout(checkStatus, delayMs);
					} else {
						localStorage.removeItem(STORAGE_KEY);
						dismissLoading();
						toast.info(
							'Top-up is still processing. Balance will update automatically.',
						);
					}
				} catch {
					if (attempts < maxAttempts) {
						setTimeout(checkStatus, delayMs);
					} else {
						localStorage.removeItem(STORAGE_KEY);
						dismissLoading();
						toast.error('Could not verify top-up. Please check your balance.');
					}
				}
			};

			setTimeout(checkStatus, 1500);
		}
	}, [setBalance, removeToast]);
}
