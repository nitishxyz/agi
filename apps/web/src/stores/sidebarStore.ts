import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
	isCollapsed: boolean;
	wasCollapsedBeforeDiff: boolean | null; // Track state before diff opened
	toggleCollapse: () => void;
	setCollapsed: (collapsed: boolean) => void;
	setWasCollapsedBeforeDiff: (state: boolean | null) => void;
}

export const useSidebarStore = create<SidebarState>()(
	persist(
		(set) => ({
			isCollapsed: false,
			wasCollapsedBeforeDiff: null,
			toggleCollapse: () =>
				set((state) => ({ isCollapsed: !state.isCollapsed })),
			setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
			setWasCollapsedBeforeDiff: (state) =>
				set({ wasCollapsedBeforeDiff: state }),
		}),
		{
			name: 'sidebar-storage',
			// Don't persist wasCollapsedBeforeDiff - it's only for runtime state
			partialize: (state) => ({
				isCollapsed: state.isCollapsed,
			}),
		},
	),
);
