import { useEffect, useRef } from 'react';
import { useToastStore, toast } from '../stores/toastStore';
import { useSetuStore } from '../stores/setuStore';
import { apiClient } from '../lib/api-client';

const STORAGE_KEY = 'pendingPolarCheckout';

export function useTopupCallback() {
	const hasHandled = useRef(false);
	const loadingToastId = useRef<string | null>(null);
	const setBalance = useSetuStore((s) => s.setBalance);
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
				toast.info('Checking payment status...');
				return;
			}

			loadingToastId.current = toast.loading('Verifying payment...');

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

						const balanceData = await apiClient.getSetuBalance();
						if (balanceData?.balance !== undefined) {
							setBalance(balanceData.balance);
						}

						toast.success(
							`Payment confirmed! +$${status.amountUsd?.toFixed(2)} credited`,
						);
						return;
					}

					if (attempts < maxAttempts) {
						setTimeout(checkStatus, delayMs);
					} else {
						localStorage.removeItem(STORAGE_KEY);
						dismissLoading();
						toast.info(
							'Payment processing. Balance will update automatically.',
						);
					}
				} catch {
					if (attempts < maxAttempts) {
						setTimeout(checkStatus, delayMs);
					} else {
						localStorage.removeItem(STORAGE_KEY);
						dismissLoading();
						toast.error('Could not verify payment. Please check your balance.');
					}
				}
			};

			setTimeout(checkStatus, 1500);
		}
	}, [setBalance, removeToast]);
}
