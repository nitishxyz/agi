import { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
	CreditCard,
	Wallet,
	Loader2,
	ExternalLink,
	CheckCircle,
	RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useSetuStore } from '../../stores/setuStore';
import { apiClient } from '../../lib/api-client';
import { toast } from '../../stores/toastStore';

const PRESET_AMOUNTS = [10, 25, 50, 100];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;
const POLL_INTERVAL = 5000;
const SUCCESS_PAGE_URL = 'https://share.agi.nitish.sh/checkout/success';

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

	const [amount, setAmount] = useState<number>(25);
	const [customAmount, setCustomAmount] = useState<string>('');
	const [isCustom, setIsCustom] = useState(false);
	const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
	const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);
	const [isPolling, setIsPolling] = useState(false);
	const [isConfirmed, setIsConfirmed] = useState(false);
	const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
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
		if (isOpen && effectiveAmount >= MIN_AMOUNT && !checkoutInfo) {
			const timeout = setTimeout(() => fetchEstimate(effectiveAmount), 300);
			return () => clearTimeout(timeout);
		}
	}, [isOpen, effectiveAmount, fetchEstimate, checkoutInfo]);

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
			setCheckoutInfo(null);
			setIsConfirmed(false);
			setConfirmedAmount(null);
		}
	}, [isOpen, stopPolling]);

	useEffect(() => {
		return () => stopPolling();
	}, [stopPolling]);

	const startPolling = useCallback(
		(checkoutId: string) => {
			if (pollRef.current) return;
			setIsPolling(true);

			const check = async () => {
				try {
					const status = await apiClient.getPolarTopupStatus(checkoutId);
					if (status?.confirmed) {
						stopPolling();
						setIsConfirmed(true);
						setConfirmedAmount(status.amountUsd);
						localStorage.removeItem('pendingPolarCheckout');

						const balanceData = await apiClient.getSetuBalance();
						if (balanceData?.balance !== undefined) {
							setBalance(balanceData.balance);
						}
					}
				} catch {
					// keep polling
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
				if (window.self !== window.top) {
					window.parent.postMessage(
						{ type: 'agi-open-url', url: result.checkoutUrl },
						'*',
					);
				} else {
					window.open(result.checkoutUrl, '_blank');
				}

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

	const handleCheckStatus = () => {
		if (!checkoutInfo) return;
		stopPolling();
		startPolling(checkoutInfo.checkoutId);
	};

	const handleDone = () => {
		closeModal();
	};

	const isValidAmount =
		effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT;

	return (
		<Modal
			isOpen={isOpen}
			onClose={closeModal}
			title={isConfirmed ? 'Payment Confirmed' : 'Add Credits'}
			maxWidth="md"
		>
			<div className="space-y-6">
				{isConfirmed ? (
					<>
						<div className="flex flex-col items-center py-6">
							<div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
								<CheckCircle className="w-7 h-7 text-green-500" />
							</div>
							<p className="text-2xl font-semibold font-mono">
								+$
								{confirmedAmount?.toFixed(2) ??
									checkoutInfo?.creditAmount.toFixed(2)}
							</p>
							<p className="text-sm text-muted-foreground mt-1">
								Credits added to your balance
							</p>
						</div>

						<button
							type="button"
							onClick={handleDone}
							className="w-full h-12 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
						>
							Done
						</button>
					</>
				) : (
					<>
						{/* Current Balance */}
						<div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-lg">
							<span className="text-sm text-muted-foreground">
								Current Balance
							</span>
							<span className="text-lg font-mono font-semibold">
								${balance?.toFixed(2) ?? '0.00'}
							</span>
						</div>

						{/* Amount Selection */}
						<div className="space-y-4">
							<div className="grid grid-cols-4 gap-2">
								{PRESET_AMOUNTS.map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => handlePresetClick(preset)}
										disabled={!!checkoutInfo}
										className={`h-12 text-base font-mono rounded-lg border-2 transition-all ${
											!isCustom && amount === preset
												? 'bg-foreground text-background border-foreground'
												: 'bg-transparent border-border text-foreground hover:border-foreground/40'
										} disabled:opacity-50 disabled:cursor-not-allowed`}
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
									disabled={!!checkoutInfo}
									min={MIN_AMOUNT}
									max={MAX_AMOUNT}
									step="1"
									className={`w-full h-12 pl-8 pr-4 text-base font-mono bg-transparent border-2 rounded-lg outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
										isCustom
											? 'border-foreground'
											: 'border-border focus:border-foreground/40'
									}`}
								/>
							</div>
						</div>

						{/* Summary */}
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

						{/* Pay / Check Status Button */}
						{checkoutInfo ? (
							<div className="space-y-3">
								<button
									type="button"
									onClick={handleCheckStatus}
									disabled={isPolling}
									className="w-full h-12 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
								>
									{isPolling ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<RefreshCw className="w-4 h-4" />
									)}
									{isPolling ? 'Checking payment status...' : 'Check Status'}
								</button>
								<button
									type="button"
									onClick={() => {
										if (window.self !== window.top) {
											window.parent.postMessage(
												{ type: 'agi-open-url', url: checkoutInfo.url },
												'*',
											);
										} else {
											window.open(checkoutInfo.url, '_blank');
										}
									}}
									className="w-full h-11 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
								>
									<ExternalLink className="w-4 h-4" />
									Reopen Checkout
								</button>
								<p className="text-xs text-muted-foreground text-center">
									Complete payment in the checkout tab. Status checks
									automatically every 5 seconds.
								</p>
							</div>
						) : (
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
						)}

				{/* USDC Option */}
				<div
					className={`grid transition-all duration-300 ease-out ${
						checkoutInfo
							? 'grid-rows-[0fr] opacity-0'
							: 'grid-rows-[1fr] opacity-100'
					}`}
				>
				<div className="overflow-hidden min-h-0">
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
					</div>
				</div>
					</>
				)}
			</div>
		</Modal>
	);
});
