import { useEffect, useRef } from 'react';
import { SSEClient } from '../lib/sse-client';
import { apiClient } from '../lib/api-client';
import { toast, useToastStore } from '../stores/toastStore';
import { useSolforgeStore } from '../stores/solforgeStore';

export function useSolforgePayments(sessionId: string | undefined) {
	const clientRef = useRef<SSEClient | null>(null);
	const loadingToastIdRef = useRef<string | null>(null);
	const setBalance = useSolforgeStore((s) => s.setBalance);
	const setPaymentPending = useSolforgeStore((s) => s.setPaymentPending);
	const removeToast = useToastStore((s) => s.removeToast);
	const updateToast = useToastStore((s) => s.updateToast);

	useEffect(() => {
		if (!sessionId) return;

		const client = new SSEClient();
		clientRef.current = client;

		const url = apiClient.getStreamUrl(sessionId);
		client.connect(url);

		const unsubscribe = client.on('*', (event) => {
			const payload = event.payload as Record<string, unknown> | undefined;

			switch (event.type) {
				case 'solforge.payment.required': {
					const amountUsd =
						typeof payload?.amountUsd === 'number' ? payload.amountUsd : 0;
					setPaymentPending(true);
					loadingToastIdRef.current = toast.loading(
						`💳 Payment required: $${amountUsd.toFixed(2)}`,
					);
					break;
				}
				case 'solforge.payment.signing': {
					if (loadingToastIdRef.current) {
						updateToast(loadingToastIdRef.current, {
							message: '✍️ Signing transaction...',
						});
					} else {
						loadingToastIdRef.current = toast.loading('✍️ Signing transaction...');
					}
					break;
				}
				case 'solforge.payment.complete': {
					const rawAmount = payload?.amountUsd;
					const rawBalance = payload?.newBalance;
					const amountUsd = typeof rawAmount === 'number' 
						? rawAmount 
						: (typeof rawAmount === 'string' ? parseFloat(rawAmount) : 0);
					const newBalance = typeof rawBalance === 'number'
						? rawBalance
						: (typeof rawBalance === 'string' ? parseFloat(rawBalance) : 0);
					setBalance(newBalance);
					setPaymentPending(false);
					if (loadingToastIdRef.current) {
						removeToast(loadingToastIdRef.current);
						loadingToastIdRef.current = null;
					}
					toast.success(
						`✅ Paid $${amountUsd.toFixed(2)} • Balance: $${newBalance.toFixed(2)}`,
					);
					break;
				}
				case 'solforge.payment.error': {
					const error =
						typeof payload?.error === 'string' ? payload.error : 'Payment failed';
					setPaymentPending(false);
					if (loadingToastIdRef.current) {
						removeToast(loadingToastIdRef.current);
						loadingToastIdRef.current = null;
					}
					toast.error(`❌ ${error}`);
					break;
				}
				default:
					break;
			}
		});

		return () => {
			unsubscribe();
			client.disconnect();
		};
	}, [sessionId, setBalance, setPaymentPending, removeToast, updateToast]);
}
