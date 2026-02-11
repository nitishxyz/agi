import { create } from 'zustand';
import type { ProviderUsageResponse } from '../types/api';

interface UsageState {
	usage: Record<string, ProviderUsageResponse>;
	isLoading: Record<string, boolean>;
	lastFetched: Record<string, number>;
	isModalOpen: boolean;
	modalProvider: string | null;
	setUsage: (provider: string, data: ProviderUsageResponse) => void;
	setLoading: (provider: string, loading: boolean) => void;
	setLastFetched: (provider: string, time: number) => void;
	openModal: (provider: string) => void;
	closeModal: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
	usage: {},
	isLoading: {},
	lastFetched: {},
	isModalOpen: false,
	modalProvider: null,
	setUsage: (provider, data) =>
		set((s) => ({ usage: { ...s.usage, [provider]: data } })),
	setLoading: (provider, loading) =>
		set((s) => ({ isLoading: { ...s.isLoading, [provider]: loading } })),
	setLastFetched: (provider, time) =>
		set((s) => ({ lastFetched: { ...s.lastFetched, [provider]: time } })),
	openModal: (provider) =>
		set({ isModalOpen: true, modalProvider: provider }),
	closeModal: () => set({ isModalOpen: false, modalProvider: null }),
}));
