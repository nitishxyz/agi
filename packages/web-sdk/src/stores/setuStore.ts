import { create } from 'zustand';

interface SetuSubscription {
	active: boolean;
	tierId?: string;
	tierName?: string;
	creditsIncluded?: number;
	creditsUsed?: number;
	creditsRemaining?: number;
	periodStart?: string;
	periodEnd?: string;
}

interface SetuPayg {
	walletBalanceUsd: number;
	accountBalanceUsd: number;
	rawPoolUsd: number;
	effectiveSpendableUsd: number;
}

interface SetuLimits {
	enabled: boolean;
	dailyLimitUsd: number | null;
	dailySpentUsd: number;
	dailyRemainingUsd: number | null;
	monthlyLimitUsd: number | null;
	monthlySpentUsd: number;
	monthlyRemainingUsd: number | null;
	capRemainingUsd: number | null;
}

interface SetuState {
	balance: number | null;
	usdcBalance: number | null;
	network: 'mainnet' | 'devnet';
	isPaymentPending: boolean;
	lastPaymentAmount: number | null;
	walletAddress: string | null;
	isLoading: boolean;
	isTopupModalOpen: boolean;
	scope: 'wallet' | 'account' | null;
	payg: SetuPayg | null;
	subscription: SetuSubscription | null;
	limits: SetuLimits | null;
	setBalance: (balance: number | null) => void;
	setUsdcBalance: (usdcBalance: number | null) => void;
	setNetwork: (network: 'mainnet' | 'devnet') => void;
	setPaymentPending: (pending: boolean) => void;
	setLastPaymentAmount: (amount: number | null) => void;
	setWalletAddress: (address: string | null) => void;
	setLoading: (loading: boolean) => void;
	openTopupModal: () => void;
	closeTopupModal: () => void;
	setScope: (scope: 'wallet' | 'account' | null) => void;
	setPayg: (payg: SetuPayg | null) => void;
	setSubscription: (subscription: SetuSubscription | null) => void;
	setLimits: (limits: SetuLimits | null) => void;
}

export const useSetuStore = create<SetuState>((set) => ({
	balance: null,
	usdcBalance: null,
	network: 'mainnet',
	isPaymentPending: false,
	lastPaymentAmount: null,
	walletAddress: null,
	isLoading: false,
	isTopupModalOpen: false,
	scope: null,
	payg: null,
	subscription: null,
	limits: null,
	setBalance: (balance) => set({ balance }),
	setUsdcBalance: (usdcBalance) => set({ usdcBalance }),
	setNetwork: (network) => set({ network }),
	setPaymentPending: (isPaymentPending) => set({ isPaymentPending }),
	setLastPaymentAmount: (lastPaymentAmount) => set({ lastPaymentAmount }),
	setWalletAddress: (walletAddress) => set({ walletAddress }),
	setLoading: (isLoading) => set({ isLoading }),
	openTopupModal: () => set({ isTopupModalOpen: true }),
	closeTopupModal: () => set({ isTopupModalOpen: false }),
	setScope: (scope) => set({ scope }),
	setPayg: (payg) => set({ payg }),
	setSubscription: (subscription) => set({ subscription }),
	setLimits: (limits) => set({ limits }),
}));
