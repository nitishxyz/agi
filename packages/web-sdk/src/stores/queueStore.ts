import { create } from 'zustand';

interface QueueState {
	pendingRestoreText: string | null;
	setPendingRestoreText: (text: string | null) => void;
	consumeRestoreText: () => string | null;
}

export const useQueueStore = create<QueueState>((set, get) => ({
	pendingRestoreText: null,
	setPendingRestoreText: (text) => set({ pendingRestoreText: text }),
	consumeRestoreText: () => {
		const text = get().pendingRestoreText;
		set({ pendingRestoreText: null });
		return text;
	},
}));
