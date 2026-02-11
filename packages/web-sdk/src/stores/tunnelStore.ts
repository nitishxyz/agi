import { create } from 'zustand';
import { useGitStore } from './gitStore';
import { useSessionFilesStore } from './sessionFilesStore';
import { useSettingsStore } from './settingsStore';
import { useResearchStore } from './researchStore';

export type TunnelStatus = 'idle' | 'starting' | 'connected' | 'error';

interface TunnelState {
	isExpanded: boolean;
	status: TunnelStatus;
	url: string | null;
	qrCode: string | null;
	error: string | null;
	progress: string | null;

	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;
	setStatus: (status: TunnelStatus) => void;
	setUrl: (url: string | null) => void;
	setQrCode: (qrCode: string | null) => void;
	setError: (error: string | null) => void;
	setProgress: (progress: string | null) => void;
	reset: () => void;
}

export const useTunnelStore = create<TunnelState>((set) => ({
	isExpanded: false,
	status: 'idle',
	url: null,
	qrCode: null,
	error: null,
	progress: null,

	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useGitStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
				useSettingsStore.getState().collapseSidebar();
				useResearchStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},

	expandSidebar: () => {
		useGitStore.getState().collapseSidebar();
		useSessionFilesStore.getState().collapseSidebar();
		useSettingsStore.getState().collapseSidebar();
		useResearchStore.getState().collapseSidebar();
		set({ isExpanded: true });
	},

	collapseSidebar: () => set({ isExpanded: false }),

	setStatus: (status) => set({ status }),
	setUrl: (url) => set({ url }),
	setQrCode: (qrCode) => set({ qrCode }),
	setError: (error) => set({ error }),
	setProgress: (progress) => set({ progress }),

	reset: () =>
		set({
			status: 'idle',
			url: null,
			qrCode: null,
			error: null,
			progress: null,
		}),
}));
