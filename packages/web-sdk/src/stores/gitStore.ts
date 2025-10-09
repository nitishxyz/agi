import { create } from 'zustand';

interface GitState {
	// Sidebar state
	isExpanded: boolean;

	// Diff panel state
	selectedFile: string | null;
	selectedFileStaged: boolean;
	isDiffOpen: boolean;

	// Commit modal state
	isCommitModalOpen: boolean;

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
	wasSessionListCollapsed: false,

	// Sidebar actions
	toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
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
	closeCommitModal: () => set({ isCommitModalOpen: false }),

	// Session list collapse
	setSessionListCollapsed: (collapsed) =>
		set({ wasSessionListCollapsed: collapsed }),
}));
