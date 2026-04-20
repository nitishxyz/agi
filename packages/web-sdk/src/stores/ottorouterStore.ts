import { create } from 'zustand';

interface OttoRouterUsageWindow {
	limit: number | null;
	used: number;
	remaining: number | null;
	percentUsed: number;
}

interface OttoRouterSubscription {
	active: boolean;
	tierId?: string;
	tierName?: string;
	creditsIncluded?: number;
	creditsUsed?: number;
	creditsRemaining?: number;
	creditsWeeklyLimit?: number | null;
	creditsFiveHourLimit?: number | null;
	usageWindows?: {
		weekly: OttoRouterUsageWindow;
		fiveHour: OttoRouterUsageWindow;
	};
	periodStart?: string;
	periodEnd?: string;
}

interface OttoRouterPayg {
	walletBalanceUsd: number;
	accountBalanceUsd: number;
	rawPoolUsd: number;
	effectiveSpendableUsd: number;
}

interface OttoRouterLimits {
	enabled: boolean;
	dailyLimitUsd: number | null;
	dailySpentUsd: number;
	dailyRemainingUsd: number | null;
	monthlyLimitUsd: number | null;
	monthlySpentUsd: number;
	monthlyRemainingUsd: number | null;
	capRemainingUsd: number | null;
}

interface OttoRouterState {
	balance: number | null;
	usdcBalance: number | null;
	network: 'mainnet' | 'devnet';
	isPaymentPending: boolean;
	lastPaymentAmount: number | null;
	walletAddress: string | null;
	isLoading: boolean;
	isTopupModalOpen: boolean;
	scope: 'wallet' | 'account' | null;
	payg: OttoRouterPayg | null;
	subscription: OttoRouterSubscription | null;
	limits: OttoRouterLimits | null;
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
	setPayg: (payg: OttoRouterPayg | null) => void;
	setSubscription: (subscription: OttoRouterSubscription | null) => void;
	setLimits: (limits: OttoRouterLimits | null) => void;
}

export const useOttoRouterStore = create<OttoRouterState>((set) => ({
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
