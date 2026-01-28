import { useEffect, useRef } from 'react';
import { SSEClient } from '../lib/sse-client';
import { apiClient } from '../lib/api-client';
import { toast, useToastStore } from '../stores/toastStore';
import { useSetuStore } from '../stores/setuStore';
import { useTopupApprovalStore } from '../stores/topupApprovalStore';

export function useSetuPayments(sessionId: string | undefined) {
	const clientRef = useRef<SSEClient | null>(null);
	const loadingToastIdRef = useRef<string | null>(null);
	const setBalance = useSetuStore((s) => s.setBalance);
	const setPaymentPending = useSetuStore((s) => s.setPaymentPending);
	const removeToast = useToastStore((s) => s.removeToast);
	const updateToast = useToastStore((s) => s.updateToast);
	const setPendingTopup = useTopupApprovalStore((s) => s.setPendingTopup);
	const clearPendingTopup = useTopupApprovalStore((s) => s.clearPendingTopup);

	useEffect(() => {
		if (!sessionId) return;

		const client = new SSEClient();
		clientRef.current = client;

		const url = apiClient.getStreamUrl(sessionId);
		client.connect(url);

		const unsubscribe = client.on('*', (event) => {
			const payload = event.payload as Record<string, unknown> | undefined;

			switch (event.type) {
				case 'setu.topup.required': {
					const amountUsd =
						typeof payload?.amountUsd === 'number' ? payload.amountUsd : 0;
					const currentBalance =
						typeof payload?.currentBalance === 'number'
							? payload.currentBalance
							: 0;
					const minTopupUsd =
						typeof payload?.minTopupUsd === 'number' ? payload.minTopupUsd : 5;
					const suggestedTopupUsd =
						typeof payload?.suggestedTopupUsd === 'number'
							? payload.suggestedTopupUsd
							: 10;
					const messageId =
						typeof payload?.messageId === 'string' ? payload.messageId : '';

					setPendingTopup({
						sessionId,
						messageId,
						amountUsd,
						currentBalance,
						minTopupUsd,
						suggestedTopupUsd,
					});
					break;
				}

				case 'setu.topup.method_selected': {
					const method = payload?.method;
					if (method === 'crypto') {
						setPaymentPending(true);
						loadingToastIdRef.current = toast.loading(
							'💳 Processing crypto payment...',
						);
					}
					break;
				}

				case 'setu.topup.cancelled': {
					clearPendingTopup();
					const reason =
						typeof payload?.reason === 'string'
							? payload.reason
							: 'Request cancelled';
				toast(`⚠️ ${reason}`);
					break;
				}

				case 'setu.payment.required': {
					const amountUsd =
						typeof payload?.amountUsd === 'number' ? payload.amountUsd : 0;
					setPaymentPending(true);
					if (!loadingToastIdRef.current) {
						loadingToastIdRef.current = toast.loading(
							`💳 Payment required: $${amountUsd.toFixed(2)}`,
						);
					}
					break;
				}

				case 'setu.payment.signing': {
					if (loadingToastIdRef.current) {
						updateToast(loadingToastIdRef.current, {
							message: '✍️ Signing transaction...',
						});
					} else {
						loadingToastIdRef.current = toast.loading(
							'✍️ Signing transaction...',
						);
					}
					break;
				}

				case 'setu.payment.complete': {
					clearPendingTopup();
					const rawAmount = payload?.amountUsd;
					const rawBalance = payload?.newBalance;
					const transactionId =
						typeof payload?.transactionId === 'string'
							? payload.transactionId
							: undefined;
					const amountUsd =
						typeof rawAmount === 'number'
							? rawAmount
							: typeof rawAmount === 'string'
								? parseFloat(rawAmount)
								: 0;
					const newBalance =
						typeof rawBalance === 'number'
							? rawBalance
							: typeof rawBalance === 'string'
								? parseFloat(rawBalance)
								: 0;
					setBalance(newBalance);
					setPaymentPending(false);
					if (loadingToastIdRef.current) {
						removeToast(loadingToastIdRef.current);
						loadingToastIdRef.current = null;
					}
					const message = `✅ Paid $${amountUsd.toFixed(2)}`;
					if (transactionId) {
						toast.successWithAction(message, {
							label: 'View Tx',
							href: `https://orbmarkets.io/tx/${transactionId}`,
						});
					} else {
						toast.success(message);
					}
					break;
				}

			case 'setu.fiat.checkout_created': {
				clearPendingTopup();
				setPaymentPending(false);
				if (loadingToastIdRef.current) {
					removeToast(loadingToastIdRef.current);
					loadingToastIdRef.current = null;
				}
				// Modal is already opened by TopupApprovalCard
				// Just show a helpful toast
				toast.success('💳 Complete payment, then retry your message');
				break;
			}

			case 'setu.payment.error': {
					clearPendingTopup();
					const error =
						typeof payload?.error === 'string'
							? payload.error
							: 'Payment failed';
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
	}, [
		sessionId,
		setBalance,
		setPaymentPending,
		removeToast,
		updateToast,
		setPendingTopup,
		clearPendingTopup,
	]);
}
