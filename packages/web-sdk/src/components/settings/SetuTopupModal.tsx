import { memo, useState, useEffect, useCallback } from 'react';
import {
	CreditCard,
	Wallet,
	Loader2,
	ExternalLink,
	CheckCircle,
	Copy,
	ArrowLeft,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useSetuStore } from '../../stores/setuStore';
import { apiClient } from '../../lib/api-client';
import { toast } from '../../stores/toastStore';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;

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
	const usdcBalance = useSetuStore((s) => s.usdcBalance);

	const [amount, setAmount] = useState<number>(10);
	const [customAmount, setCustomAmount] = useState<string>('');
	const [isCustom, setIsCustom] = useState(false);
	const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
	const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);

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

	useEffect(() => {
		if (!isOpen) {
			setCheckoutInfo(null);
		}
	}, [isOpen]);

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
			// Create checkout first to get the ID
			const baseSuccessUrl = `${window.location.origin}${window.location.pathname}`;
			const result = await apiClient.createPolarCheckout(
				effectiveAmount,
				`${baseSuccessUrl}?topup=pending`,
			);

			if (result.checkoutUrl && result.checkoutId) {
				// Update checkoutInfo with URL that includes checkoutId
				setCheckoutInfo({
					url: result.checkoutUrl,
					checkoutId: result.checkoutId,
					creditAmount: result.creditAmount,
					chargeAmount: result.chargeAmount,
				});
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Failed to create checkout',
			);
		} finally {
			setIsCreatingCheckout(false);
		}
	};

	const handleOpenCheckout = () => {
		if (checkoutInfo?.url) {
			// Store checkoutId in localStorage for the callback hook to use
			localStorage.setItem('pendingPolarCheckout', checkoutInfo.checkoutId);
			window.open(checkoutInfo.url, '_blank');
		}
	};

	const handleCopyLink = async () => {
		if (checkoutInfo?.url) {
			await navigator.clipboard.writeText(checkoutInfo.url);
			toast.success('Link copied to clipboard');
		}
	};

	const handleBack = () => {
		setCheckoutInfo(null);
	};

	const isValidAmount =
		effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT;

	if (checkoutInfo) {
		return (
			<Modal
				isOpen={isOpen}
				onClose={closeModal}
				title="Complete Payment"
				maxWidth="md"
			>
				<div className="space-y-6">
					<div className="flex items-center justify-center py-4">
						<div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
							<CheckCircle className="w-8 h-8 text-green-500" />
						</div>
					</div>

					<div className="text-center space-y-2">
						<h3 className="text-lg font-semibold">Checkout Ready</h3>
						<p className="text-sm text-muted-foreground">
							Click the button below to complete your payment of{' '}
							<span className="font-mono font-medium text-foreground">
								${checkoutInfo.chargeAmount.toFixed(2)}
							</span>{' '}
							for{' '}
							<span className="font-mono font-medium text-foreground">
								${checkoutInfo.creditAmount.toFixed(2)}
							</span>{' '}
							in credits.
						</p>
					</div>

					<div className="space-y-3">
						<Button
							onClick={handleOpenCheckout}
							className="w-full justify-center gap-2"
						>
							<CreditCard className="w-4 h-4" />
							Open Checkout
							<ExternalLink className="w-3 h-3 ml-1" />
						</Button>

						<div className="flex gap-2">
							<Button
								variant="secondary"
								onClick={handleCopyLink}
								className="flex-1 justify-center gap-2"
							>
								<Copy className="w-4 h-4" />
								Copy Link
							</Button>
							<Button
								variant="ghost"
								onClick={handleBack}
								className="flex-1 justify-center gap-2"
							>
								<ArrowLeft className="w-4 h-4" />
								Back
							</Button>
						</div>
					</div>

					<p className="text-xs text-muted-foreground text-center">
						After completing payment, your balance will be credited within a few
						seconds.
					</p>
				</div>
			</Modal>
		);
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={closeModal}
			title="Top Up Balance"
			maxWidth="md"
		>
			<div className="space-y-6">
				<div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
					<span className="text-muted-foreground">Current Balance</span>
					<span className="font-mono font-medium">
						${balance?.toFixed(4) ?? '0.0000'}
					</span>
				</div>

				<div className="space-y-3">
					<label className="text-sm font-medium">Select Amount</label>
					<div className="grid grid-cols-5 gap-2">
						{PRESET_AMOUNTS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => handlePresetClick(preset)}
								className={`px-3 py-2 text-sm font-mono rounded-md border transition-colors ${
									!isCustom && amount === preset
										? 'bg-primary text-primary-foreground border-primary'
										: 'bg-muted hover:bg-muted/80 border-border'
								}`}
							>
								${preset}
							</button>
						))}
					</div>
					<div className="relative">
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
							$
						</span>
						<input
							type="number"
							placeholder="Custom amount"
							value={customAmount}
							onChange={(e) => handleCustomAmountChange(e.target.value)}
							onFocus={() => setIsCustom(true)}
							min={MIN_AMOUNT}
							max={MAX_AMOUNT}
							step="0.01"
							className={`w-full pl-7 pr-3 py-2 text-sm font-mono bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
								isCustom ? 'border-primary' : 'border-border'
							}`}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						Min ${MIN_AMOUNT} · Max ${MAX_AMOUNT}
					</p>
				</div>

				{isValidAmount && (
					<div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex flex-col justify-center">
						{isLoadingEstimate ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
							</div>
						) : estimate ? (
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Credit Amount</span>
									<span className="font-mono">
										${estimate.creditAmount.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Processing Fee</span>
									<span className="font-mono text-orange-500">
										+${estimate.feeAmount.toFixed(2)}
									</span>
								</div>
								<div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
									<span>You Pay</span>
									<span className="font-mono">
										${estimate.chargeAmount.toFixed(2)}
									</span>
								</div>
								<p className="text-xs text-muted-foreground pt-1">
									Fee: 4% + $0.40 (+ 1.5% for international cards)
								</p>
							</div>
						) : null}
					</div>
				)}

				<div className="space-y-3">
					<label className="text-sm font-medium">Payment Method</label>

					<Button
						onClick={handlePolarCheckout}
						disabled={!isValidAmount || isCreatingCheckout}
						className="w-full justify-center gap-2"
					>
						{isCreatingCheckout ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<CreditCard className="w-4 h-4" />
						)}
						Pay with Card
					</Button>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-border" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="bg-background px-2 text-muted-foreground">
								or
							</span>
						</div>
					</div>

					<div className="bg-muted/30 rounded-lg p-4 space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium">
							<Wallet className="w-4 h-4" />
							Crypto (USDC)
						</div>
						<p className="text-xs text-muted-foreground">
							Send USDC to your Setu wallet. Auto top-up triggers when balance
							is low during API calls.
						</p>
						{usdcBalance !== null && (
							<p className="text-xs">
								<span className="text-muted-foreground">Wallet USDC: </span>
								<span className="font-mono">{usdcBalance.toFixed(2)} USDC</span>
							</p>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
});
