import { create } from 'zustand';

export type TabActivityStatus = 'idle' | 'loading' | 'busy';

interface TabActivityEntry {
	status: TabActivityStatus;
	message?: string;
}

interface TabActivityState {
	entries: Record<string, TabActivityEntry>;
	setStatus: (tabId: string, status: TabActivityStatus, message?: string) => void;
	clear: (tabId: string) => void;
}

export const useTabActivityStore = create<TabActivityState>((set) => ({
	entries: {},

	setStatus: (tabId, status, message) => {
		set((state) => ({
			entries: {
				...state.entries,
				[tabId]: { status, message },
			},
		}));
	},

	clear: (tabId) => {
		set((state) => {
			const next = { ...state.entries };
			delete next[tabId];
			return { entries: next };
		});
	},
}));
