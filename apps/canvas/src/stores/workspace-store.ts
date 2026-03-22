import { create } from 'zustand';

export interface Workspace {
	id: string;
	name: string;
	icon: string;
	color: string;
}

interface WorkspaceState {
	workspaces: Workspace[];
	activeId: string | null;
	sidebarCollapsed: boolean;
	setActive: (id: string) => void;
	addWorkspace: (name: string) => void;
	removeWorkspace: (id: string) => void;
	toggleSidebar: () => void;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

function generateId() {
	return crypto.randomUUID().slice(0, 8);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
	workspaces: [
		{ id: 'default', name: 'otto-server', icon: '●', color: '#6366f1' },
	],
	activeId: 'default',
	sidebarCollapsed: false,

	setActive: (id) => set({ activeId: id }),

	addWorkspace: (name) => {
		const id = generateId();
		const color = COLORS[get().workspaces.length % COLORS.length];
		set((s) => ({
			workspaces: [...s.workspaces, { id, name, icon: '●', color }],
			activeId: id,
		}));
	},

	removeWorkspace: (id) => {
		set((s) => {
			const filtered = s.workspaces.filter((w) => w.id !== id);
			const activeId = s.activeId === id ? (filtered[0]?.id ?? null) : s.activeId;
			return { workspaces: filtered, activeId };
		});
	},

	toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
