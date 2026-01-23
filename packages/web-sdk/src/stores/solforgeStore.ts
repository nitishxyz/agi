import { create } from 'zustand';

interface SolforgeState {
	balance: number | null;
	isPaymentPending: boolean;
	lastPaymentAmount: number | null;
	setBalance: (balance: number | null) => void;
	setPaymentPending: (pending: boolean) => void;
	setLastPaymentAmount: (amount: number | null) => void;
}

export const useSolforgeStore = create<SolforgeState>((set) => ({
	balance: null,
	isPaymentPending: false,
	lastPaymentAmount: null,
	setBalance: (balance) => set({ balance }),
	setPaymentPending: (isPaymentPending) => set({ isPaymentPending }),
	setLastPaymentAmount: (lastPaymentAmount) => set({ lastPaymentAmount }),
}));
