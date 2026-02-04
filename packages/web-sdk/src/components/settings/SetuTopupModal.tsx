import { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
	CreditCard,
	Wallet,
	Loader2,
	ExternalLink,
	RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useSetuStore } from '../../stores/setuStore';
import { apiClient } from '../../lib/api-client';
import { toast } from '../../stores/toastStore';
import { StatusIndicator } from '../common/StatusIndicator';

const PRESET_AMOUNTS = [10, 25, 50, 100];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;
const POLL_INTERVAL = 5000;
const SUCCESS_PAGE_URL = 'https://share.ottocode.io/checkout/success';

type ModalView = 'amount' | 'checkout' | 'confirmed';

interface FeeEstimate {
	creditAmount: number;
	chargeAmount: number;
	feeAmount: number;
}

interface CheckoutInfo {
	url: string;
	checkoutId: string;
	creditAmount: number;
	chargeAmount: number;
}

export const SetuTopupModal = memo(function SetuTopupModal() {
	const isOpen = useSetuStore((s) => s.isTopupModalOpen);
	const closeModal = useSetuStore((s) => s.closeTopupModal);
	const balance = useSetuStore((s) => s.balance);
	const setBalance = useSetuStore((s) => s.setBalance);
	const usdcBalance = useSetuStore((s) => s.usdcBalance);

	const [view, setView] = useState<ModalView>('amount');
	const [amount, setAmount] = useState<number>(25);
	const [customAmount, setCustomAmount] = useState<string>('');
	const [isCustom, setIsCustom] = useState(false);
	const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
	const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);
	const [isPolling, setIsPolling] = useState(false);
	const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
	const [pollCount, setPollCount] = useState(0);
	const [isManualChecking, setIsManualChecking] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const effectiveAmount = isCustom ? parseFloat(customAmount) || 0 : amount;

	const fetchEstimate = useCallback(async (amt: number) => {
		if (amt < MIN_AMOUNT || amt > MAX_AMOUNT) {
			setEstimate(null);
			return;
		}
		setIsLoadingEstimate(true);
		try {
			const result = await apiClient.getPolarTopupEstimate(amt);
			setEstimate(result);
		} catch {
			setEstimate(null);
		} finally {
			setIsLoadingEstimate(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen && effectiveAmount >= MIN_AMOUNT && view === 'amount') {
			const timeout = setTimeout(() => fetchEstimate(effectiveAmount), 300);
			return () => clearTimeout(timeout);
		}
	}, [isOpen, effectiveAmount, fetchEstimate, view]);

	const stopPolling = useCallback(() => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
		setIsPolling(false);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			stopPolling();
			setView('amount');
			setCheckoutInfo(null);
			setConfirmedAmount(null);
			setPollCount(0);
		}
	}, [isOpen, stopPolling]);

	useEffect(() => {
		return () => stopPolling();
	}, [stopPolling]);

	const startPolling = useCallback(
		(checkoutId: string) => {
			if (pollRef.current) return;
			setIsPolling(true);
			setPollCount(0);

			const check = async () => {
				try {
					const status = await apiClient.getPolarTopupStatus(checkoutId);
					console.log('[SetuTopupModal] Poll status:', status);
					setPollCount((c) => c + 1);
					if (status?.confirmed) {
						stopPolling();
						setConfirmedAmount(status.amountUsd);
						localStorage.removeItem('pendingPolarCheckout');

						const balanceData = await apiClient.getSetuBalance();
						if (balanceData?.balance !== undefined) {
							setBalance(balanceData.balance);
						}
						setView('confirmed');
					}
				} catch {
					setPollCount((c) => c + 1);
				}
			};

			check();
			pollRef.current = setInterval(check, POLL_INTERVAL);
		},
		[stopPolling, setBalance],
	);

	const handlePresetClick = (preset: number) => {
		setAmount(preset);
		setIsCustom(false);
		setCustomAmount('');
	};

	const handleCustomAmountChange = (value: string) => {
		setCustomAmount(value);
		setIsCustom(true);
	};

	const openCheckoutUrl = useCallback((url: string) => {
		if (window.self !== window.top) {
			window.parent.postMessage({ type: 'otto-open-url', url }, '*');
		} else {
			window.open(url, '_blank');
		}
	}, []);

	const handlePolarCheckout = async () => {
		if (effectiveAmount < MIN_AMOUNT || effectiveAmount > MAX_AMOUNT) {
			toast.error(`Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}`);
			return;
		}

		setIsCreatingCheckout(true);
		try {
			const result = await apiClient.createPolarCheckout(
				effectiveAmount,
				SUCCESS_PAGE_URL,
			);

			if (result.checkoutUrl && result.checkoutId) {
				const info: CheckoutInfo = {
					url: result.checkoutUrl,
					checkoutId: result.checkoutId,
					creditAmount: result.creditAmount,
					chargeAmount: result.chargeAmount,
				};
				setCheckoutInfo(info);
				localStorage.setItem('pendingPolarCheckout', result.checkoutId);
				setView('checkout');
				openCheckoutUrl(result.checkoutUrl);
				startPolling(result.checkoutId);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Failed to create checkout',
			);
		} finally {
			setIsCreatingCheckout(false);
		}
	};

	const handleCheckNow = async () => {
		if (!checkoutInfo) return;
		setIsManualChecking(true);
		try {
			const status = await apiClient.getPolarTopupStatus(
				checkoutInfo.checkoutId,
			);
			console.log('[SetuTopupModal] Manual check status:', status);
			if (status?.confirmed) {
				stopPolling();
				setConfirmedAmount(status.amountUsd);
				localStorage.removeItem('pendingPolarCheckout');

				const balanceData = await apiClient.getSetuBalance();
				if (balanceData?.balance !== undefined) {
					setBalance(balanceData.balance);
				}
				setView('confirmed');
			} else {
				toast.error('Payment not confirmed yet. Keep waiting or try again.');
			}
		} catch (err) {
			console.error('[SetuTopupModal] Check failed:', err);
			toast.error('Failed to check payment status');
		} finally {
			setIsManualChecking(false);
		}
	};

	const handleDone = () => {
		closeModal();
	};

	const isValidAmount =
		effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT;

	const modalTitle =
		view === 'confirmed'
			? 'Payment Confirmed'
			: view === 'checkout'
				? 'Waiting for Payment'
				: 'Add Credits';

	return (
		<Modal
			isOpen={isOpen}
			onClose={closeModal}
			title={modalTitle}
			maxWidth="md"
		>
			<div className="space-y-6">
				{view === 'confirmed' && (
					<>
						<div className="py-4">
							<StatusIndicator
								status="success"
								label={`+$${confirmedAmount?.toFixed(2) ?? checkoutInfo?.creditAmount.toFixed(2)}`}
								sublabel="Credits added to your balance"
							/>
						</div>

						<button
							type="button"
							onClick={handleDone}
							className="w-full h-12 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
						>
							Done
						</button>
					</>
				)}

				{view === 'checkout' && checkoutInfo && (
					<>
						<div className="py-4">
							<StatusIndicator
								status="loading"
								label="Complete your payment"
								sublabel="A checkout window has been opened"
							/>
							<div className="flex items-center justify-center gap-2 mt-4 px-3 py-1.5 bg-muted/40 rounded-full w-fit mx-auto">
								<div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
								<span className="text-xs text-muted-foreground font-mono">
									{isPolling ? `Checking... (${pollCount})` : 'Paused'}
								</span>
							</div>
						</div>

						<div className="space-y-2">
							<button
								type="button"
								onClick={handleCheckNow}
								disabled={isManualChecking}
								className="w-full h-12 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
							>
								{isManualChecking ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<RefreshCw className="w-4 h-4" />
								)}
								{isManualChecking ? 'Checking...' : 'Check Now'}
							</button>
							<button
								type="button"
								onClick={() => openCheckoutUrl(checkoutInfo.url)}
								className="w-full h-11 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
							>
								<ExternalLink className="w-4 h-4" />
								Open Checkout Again
							</button>
						</div>

						<p className="text-xs text-muted-foreground text-center">
							Status checks automatically every 5 seconds. You can close this
							and it will keep checking.
						</p>
					</>
				)}

				{view === 'amount' && (
					<>
						<div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-lg">
							<span className="text-sm text-muted-foreground">
								Current Balance
							</span>
							<span className="text-lg font-mono font-semibold">
								${balance?.toFixed(2) ?? '0.00'}
							</span>
						</div>

						<div className="space-y-4">
							<div className="grid grid-cols-4 gap-2">
								{PRESET_AMOUNTS.map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => handlePresetClick(preset)}
										className={`h-12 text-base font-mono rounded-lg border-2 transition-all ${
											!isCustom && amount === preset
												? 'bg-foreground text-background border-foreground'
												: 'bg-transparent border-border text-foreground hover:border-foreground/40'
										}`}
									>
										${preset}
									</button>
								))}
							</div>

							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
									$
								</span>
								<input
									type="number"
									placeholder="Custom"
									value={customAmount}
									onChange={(e) => handleCustomAmountChange(e.target.value)}
									onFocus={() => setIsCustom(true)}
									min={MIN_AMOUNT}
									max={MAX_AMOUNT}
									step="1"
									className={`w-full h-12 pl-8 pr-4 text-base font-mono bg-transparent border-2 rounded-lg outline-none transition-all ${
										isCustom
											? 'border-foreground'
											: 'border-border focus:border-foreground/40'
									}`}
								/>
							</div>
						</div>

						<div
							className={`grid transition-all duration-200 ease-out ${
								isValidAmount
									? 'grid-rows-[1fr] opacity-100'
									: 'grid-rows-[0fr] opacity-0'
							}`}
						>
							<div className="overflow-hidden">
								<div className="space-y-3 py-4 border-t border-border">
									{isLoadingEstimate ? (
										<>
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted-foreground">
													Credits
												</span>
												<div className="h-6 w-16 bg-muted/60 rounded animate-pulse" />
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted-foreground">
													Fee
												</span>
												<div className="h-4 w-12 bg-muted/60 rounded animate-pulse" />
											</div>
											<div className="flex justify-between items-center pt-3 border-t border-border">
												<span className="font-medium">Total</span>
												<div className="h-7 w-20 bg-muted/60 rounded animate-pulse" />
											</div>
										</>
									) : estimate ? (
										<>
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted-foreground">
													Credits
												</span>
												<span className="font-mono text-lg">
													${estimate.creditAmount.toFixed(2)}
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted-foreground">
													Fee
												</span>
												<span className="font-mono text-sm text-muted-foreground">
													+${estimate.feeAmount.toFixed(2)}
												</span>
											</div>
											<div className="flex justify-between items-center pt-3 border-t border-border">
												<span className="font-medium">Total</span>
												<span className="font-mono text-xl font-semibold">
													${estimate.chargeAmount.toFixed(2)}
												</span>
											</div>
										</>
									) : null}
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={handlePolarCheckout}
							disabled={!isValidAmount || isCreatingCheckout}
							className="w-full h-12 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{isCreatingCheckout ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<CreditCard className="w-4 h-4" />
							)}
							Pay with Card
						</button>

						<div className="relative pt-6">
							<div className="absolute inset-x-0 top-0 flex items-center">
								<div className="flex-1 h-px bg-border" />
								<span className="px-3 text-xs text-muted-foreground">OR</span>
								<div className="flex-1 h-px bg-border" />
							</div>
							<div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
								<Wallet className="w-5 h-5 text-muted-foreground mt-0.5" />
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<span className="font-medium text-sm">Pay with USDC</span>
										{usdcBalance !== null && (
											<span className="text-xs font-mono text-muted-foreground">
												{usdcBalance.toFixed(2)} USDC
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Send USDC to your Setu wallet. Auto top-up when balance is
										low.
									</p>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</Modal>
	);
});
