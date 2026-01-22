import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useResearchStore } from './researchStore';

interface TerminalState {
	isExpanded: boolean;
	selectedTerminalId: string | null;

	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
	selectTerminal: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
	isExpanded: false,
	selectedTerminalId: null,

	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useGitStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
				useResearchStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},
	expandSidebar: () => set({ isExpanded: true }),
	collapseSidebar: () => set({ isExpanded: false, selectedTerminalId: null }),
	selectTerminal: (id) => set({ selectedTerminalId: id }),
}));
