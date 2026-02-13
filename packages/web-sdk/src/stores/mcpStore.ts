import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useResearchStore } from './researchStore';
import { useSettingsStore } from './settingsStore';
import { useTunnelStore } from './tunnelStore';
import { useFileBrowserStore } from './fileBrowserStore';

export interface MCPServerInfo {
	name: string;
	transport: string;
	command?: string;
	args: string[];
	url?: string;
	disabled: boolean;
	connected: boolean;
	tools: string[];
	authRequired: boolean;
	authenticated: boolean;
}

interface MCPState {
	isExpanded: boolean;
	servers: MCPServerInfo[];
	loading: Set<string>;

	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
	setServers: (servers: MCPServerInfo[]) => void;
	setLoading: (name: string, loading: boolean) => void;
	updateServer: (name: string, updates: Partial<MCPServerInfo>) => void;
}

export const useMCPStore = create<MCPState>((set) => ({
	isExpanded: false,
	servers: [],
	loading: new Set(),

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
		set({ isExpanded: true });
	},

	collapseSidebar: () => set({ isExpanded: false }),

	setServers: (servers) => set({ servers }),

	setLoading: (name, loading) =>
		set((state) => {
			const next = new Set(state.loading);
			if (loading) next.add(name);
			else next.delete(name);
			return { loading: next };
		}),

	updateServer: (name, updates) =>
		set((state) => ({
			servers: state.servers.map((s) =>
				s.name === name ? { ...s, ...updates } : s,
			),
		})),
}));
