import { create } from 'zustand';

interface TerminalState {
	isOpen: boolean;
	panelHeight: number;
	activeTabId: string | null;
	isMaximized: boolean;

	/** @deprecated Use isOpen instead */
	isExpanded: boolean;
	/** @deprecated Use activeTabId instead */
	selectedTerminalId: string | null;

	openPanel: () => void;
	closePanel: () => void;
	togglePanel: () => void;
	setPanelHeight: (height: number) => void;
	selectTab: (id: string | null) => void;
	toggleMaximize: () => void;

	/** @deprecated Use openPanel instead */
	expandSidebar: () => void;
	/** @deprecated Use closePanel instead */
	collapseSidebar: () => void;
	/** @deprecated Use togglePanel instead */
	toggleSidebar: () => void;
	/** @deprecated Use selectTab instead */
	selectTerminal: (id: string | null) => void;
}

const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 150;

export const useTerminalStore = create<TerminalState>((set) => ({
	isOpen: false,
	panelHeight: DEFAULT_HEIGHT,
	activeTabId: null,
	isMaximized: false,

	get isExpanded() {
		return this.isOpen;
	},
	get selectedTerminalId() {
		return this.activeTabId;
	},

	openPanel: () => set({ isOpen: true }),
	closePanel: () => set({ isOpen: false, isMaximized: false }),
	togglePanel: () =>
		set((s) => ({
			isOpen: !s.isOpen,
			isMaximized: !s.isOpen ? s.isMaximized : false,
		})),
	setPanelHeight: (height: number) =>
		set({ panelHeight: Math.max(MIN_HEIGHT, height) }),
	selectTab: (id) => set({ activeTabId: id, isOpen: true }),
	toggleMaximize: () => set((s) => ({ isMaximized: !s.isMaximized })),

	expandSidebar: () => set({ isOpen: true }),
	collapseSidebar: () => set({ isOpen: false, activeTabId: null, isMaximized: false }),
	toggleSidebar: () =>
		set((s) => ({
			isOpen: !s.isOpen,
			isMaximized: !s.isOpen ? s.isMaximized : false,
		})),
	selectTerminal: (id) => set({ activeTabId: id, isOpen: true }),
}));
