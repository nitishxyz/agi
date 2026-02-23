import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useResearchStore } from './researchStore';
import { useSettingsStore } from './settingsStore';
import { useTunnelStore } from './tunnelStore';
import { useFileBrowserStore } from './fileBrowserStore';
import { useMCPStore } from './mcpStore';

export interface SkillInfo {
	name: string;
	description: string;
	scope: string;
	path: string;
}

interface SkillsState {
	isExpanded: boolean;
	skills: SkillInfo[];
	selectedSkill: string | null;

	isViewerOpen: boolean;
	viewingFile: string | null;

	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
	setSkills: (skills: SkillInfo[]) => void;
	selectSkill: (name: string | null) => void;
	openViewer: (file: string | null) => void;
	closeViewer: () => void;
}

export const useSkillsStore = create<SkillsState>((set) => ({
	isExpanded: false,
	skills: [],
	selectedSkill: null,
	isViewerOpen: false,
	viewingFile: null,

	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useGitStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
				useResearchStore.getState().collapseSidebar();
				useSettingsStore.getState().collapseSidebar();
				useTunnelStore.getState().collapseSidebar();
				useFileBrowserStore.getState().collapseSidebar();
				useMCPStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},

	expandSidebar: () => {
		useGitStore.getState().collapseSidebar();
		useSessionFilesStore.getState().collapseSidebar();
		useResearchStore.getState().collapseSidebar();
		useSettingsStore.getState().collapseSidebar();
		useTunnelStore.getState().collapseSidebar();
		useFileBrowserStore.getState().collapseSidebar();
		useMCPStore.getState().collapseSidebar();
		set({ isExpanded: true });
	},

	collapseSidebar: () => set({ isExpanded: false }),

	setSkills: (skills) => set({ skills }),

	selectSkill: (name) =>
		set({ selectedSkill: name, isViewerOpen: false, viewingFile: null }),

	openViewer: (file) => set({ isViewerOpen: true, viewingFile: file }),

	closeViewer: () => set({ isViewerOpen: false, viewingFile: null }),
}));
