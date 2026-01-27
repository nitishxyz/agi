import { create } from 'zustand';

interface SetuState {
	balance: number | null;
	usdcBalance: number | null;
	network: 'mainnet' | 'devnet';
	isPaymentPending: boolean;
	lastPaymentAmount: number | null;
	walletAddress: string | null;
	isLoading: boolean;
	setBalance: (balance: number | null) => void;
	setUsdcBalance: (usdcBalance: number | null) => void;
	setNetwork: (network: 'mainnet' | 'devnet') => void;
	setPaymentPending: (pending: boolean) => void;
	setLastPaymentAmount: (amount: number | null) => void;
	setWalletAddress: (address: string | null) => void;
	setLoading: (loading: boolean) => void;
}

export const useSetuStore = create<SetuState>((set) => ({
	balance: null,
	usdcBalance: null,
	network: 'mainnet',
	isPaymentPending: false,
	lastPaymentAmount: null,
	walletAddress: null,
	isLoading: false,
	setBalance: (balance) => set({ balance }),
	setUsdcBalance: (usdcBalance) => set({ usdcBalance }),
	setNetwork: (network) => set({ network }),
	setPaymentPending: (isPaymentPending) => set({ isPaymentPending }),
	setLastPaymentAmount: (lastPaymentAmount) => set({ lastPaymentAmount }),
	setWalletAddress: (walletAddress) => set({ walletAddress }),
	setLoading: (isLoading) => set({ isLoading }),
}));
