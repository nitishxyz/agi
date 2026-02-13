import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useResearchStore } from './researchStore';
import { useTunnelStore } from './tunnelStore';
import { useFileBrowserStore } from './fileBrowserStore';
import { useMCPStore } from './mcpStore';

interface SettingsState {
	isExpanded: boolean;
	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
	isExpanded: false,

	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useGitStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
				useResearchStore.getState().collapseSidebar();
				useTunnelStore.getState().collapseSidebar();
				useFileBrowserStore.getState().collapseSidebar();
				useMCPStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},
	expandSidebar: () => set({ isExpanded: true }),
	collapseSidebar: () => set({ isExpanded: false }),
}));
