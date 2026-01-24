import { create } from 'zustand';

interface SolforgeState {
	balance: number | null;
	isPaymentPending: boolean;
	lastPaymentAmount: number | null;
	walletAddress: string | null;
	isLoading: boolean;
	setBalance: (balance: number | null) => void;
	setPaymentPending: (pending: boolean) => void;
	setLastPaymentAmount: (amount: number | null) => void;
	setWalletAddress: (address: string | null) => void;
	setLoading: (loading: boolean) => void;
}

export const useSolforgeStore = create<SolforgeState>((set) => ({
	balance: null,
	isPaymentPending: false,
	lastPaymentAmount: null,
	walletAddress: null,
	isLoading: false,
	setBalance: (balance) => set({ balance }),
	setPaymentPending: (isPaymentPending) => set({ isPaymentPending }),
	setLastPaymentAmount: (lastPaymentAmount) => set({ lastPaymentAmount }),
	setWalletAddress: (walletAddress) => set({ walletAddress }),
	setLoading: (isLoading) => set({ isLoading }),
}));
