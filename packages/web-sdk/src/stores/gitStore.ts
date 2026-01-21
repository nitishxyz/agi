import { create } from 'zustand';
import { useTerminalStore } from './terminalStore';
import { useSessionFilesStore } from './sessionFilesStore';

interface GitState {
	// Sidebar state
	isExpanded: boolean;

	// Diff panel state
	selectedFile: string | null;
	selectedFileStaged: boolean;
	isDiffOpen: boolean;

	// Commit modal state
	isCommitModalOpen: boolean;
	commitSessionId: string | null;

	// Session list collapse state (when diff is open)
	wasSessionListCollapsed: boolean;

	// Actions
	toggleSidebar: () => void;
	expandSidebar: () => void;
	collapseSidebar: () => void;

	openDiff: (file: string, staged: boolean) => void;
	closeDiff: () => void;
	switchFile: (file: string, staged: boolean) => void;

	openCommitModal: () => void;
	openCommitModalForSession: (sessionId: string) => void;
	closeCommitModal: () => void;

	setSessionListCollapsed: (collapsed: boolean) => void;
}

export const useGitStore = create<GitState>((set) => ({
	// Initial state
	isExpanded: false,
	selectedFile: null,
	selectedFileStaged: false,
	isDiffOpen: false,
	isCommitModalOpen: false,
	commitSessionId: null,
	wasSessionListCollapsed: false,

	// Sidebar actions
	toggleSidebar: () => {
		set((state) => {
			const newExpanded = !state.isExpanded;
			if (newExpanded) {
				useTerminalStore.getState().collapseSidebar();
				useSessionFilesStore.getState().collapseSidebar();
			}
			return { isExpanded: newExpanded };
		});
	},
	expandSidebar: () => set({ isExpanded: true }),
	collapseSidebar: () =>
		set({ isExpanded: false, isDiffOpen: false, selectedFile: null }),

	// Diff panel actions
	openDiff: (file, staged) =>
		set({
			selectedFile: file,
			selectedFileStaged: staged,
			isDiffOpen: true,
			isExpanded: true,
		}),
	closeDiff: () =>
		set({
			isDiffOpen: false,
			selectedFile: null,
		}),
	switchFile: (file, staged) =>
		set({
			selectedFile: file,
			selectedFileStaged: staged,
		}),

	// Commit modal actions
	openCommitModal: () => set({ isCommitModalOpen: true }),
	openCommitModalForSession: (sessionId: string) =>
		set({ isCommitModalOpen: true, commitSessionId: sessionId }),
	closeCommitModal: () =>
		set({ isCommitModalOpen: false, commitSessionId: null }),

	// Session list collapse
	setSessionListCollapsed: (collapsed) =>
		set({ wasSessionListCollapsed: collapsed }),
}));
