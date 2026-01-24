import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useTerminalStore } from './terminalStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useSettingsStore } from './settingsStore';

interface ResearchState {
	isExpanded: boolean;
	activeResearchSessionId: string | null;
	parentSessionId: string | null;

	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
	selectResearchSession: (id: string | null) => void;
	setParentSessionId: (id: string | null) => void;
	reset: () => void;
}

export const useResearchStore = create<ResearchState>((set, get) => ({
	isExpanded: false,
	activeResearchSessionId: null,
	parentSessionId: null,

	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useGitStore.getState().collapseSidebar();
				useTerminalStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
				useSettingsStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},

	expandSidebar: () => {
		useGitStore.getState().collapseSidebar();
		useTerminalStore.getState().collapseSidebar();
		useSessionFilesStore.getState().collapseSidebar();
		useSettingsStore.getState().collapseSidebar();
		set({ isExpanded: true });
	},

	collapseSidebar: () => set({ isExpanded: false }),

	selectResearchSession: (id) => set({ activeResearchSessionId: id }),

	setParentSessionId: (id) => {
		const currentParentId = get().parentSessionId;
		if (currentParentId !== id) {
			set({
				parentSessionId: id,
				activeResearchSessionId: null,
			});
		}
	},

	reset: () =>
		set({
			activeResearchSessionId: null,
			parentSessionId: null,
		}),
}));
