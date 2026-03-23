import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EnvironmentKind = 'local-root' | 'worktree' | 'clone' | 'remote';

export interface Workspace {
	id: string;
	name: string;
	icon: string;
	color: string;
	primaryEnvironmentId: string;
	createdAt: number;
	updatedAt: number;
	lastOpenedAt: number | null;
}

export interface Environment {
	id: string;
	workspaceId: string;
	kind: EnvironmentKind;
	path: string;
	label: string;
	isPrimary: boolean;
	createdAt: number;
	updatedAt: number;
}

interface CreateWorkspaceInput {
	name?: string;
	path: string;
}

interface WorkspaceState {
	workspaces: Workspace[];
	environments: Record<string, Environment>;
	activeId: string | null;
	sidebarCollapsed: boolean;
	setActive: (id: string) => void;
	addWorkspace: (input: CreateWorkspaceInput) => string;
	removeWorkspace: (id: string) => void;
	toggleSidebar: () => void;
	getActiveWorkspace: () => Workspace | null;
	getWorkspaceEnvironment: (workspaceId: string) => Environment | null;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

function generateId() {
	return crypto.randomUUID().slice(0, 8);
}

function getNameFromPath(path: string) {
	const normalized = path.replace(/[\\/]+$/, '');
	const parts = normalized.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] || 'workspace';
}

export const useWorkspaceStore = create<WorkspaceState>()(
	persist(
		(set, get) => ({
			workspaces: [],
			environments: {},
			activeId: null,
			sidebarCollapsed: false,

			setActive: (id) =>
				set((state) => ({
					activeId: id,
					workspaces: state.workspaces.map((workspace) =>
						workspace.id === id
							? {
								...workspace,
								lastOpenedAt: Date.now(),
								updatedAt: Date.now(),
							}
							: workspace,
					),
				})),

			addWorkspace: ({ name, path }) => {
				const normalizedPath = path.trim();
				if (!normalizedPath) {
					throw new Error('Workspace path is required');
				}

				const now = Date.now();
				const id = generateId();
				const environmentId = generateId();
				const color = COLORS[get().workspaces.length % COLORS.length];
				const nextWorkspace: Workspace = {
					id,
					name: (name?.trim() || getNameFromPath(normalizedPath)).trim(),
					icon: '●',
					color,
					primaryEnvironmentId: environmentId,
					createdAt: now,
					updatedAt: now,
					lastOpenedAt: now,
				};
				const nextEnvironment: Environment = {
					id: environmentId,
					workspaceId: id,
					kind: 'local-root',
					path: normalizedPath,
					label: 'main',
					isPrimary: true,
					createdAt: now,
					updatedAt: now,
				};

				set((state) => ({
					workspaces: [...state.workspaces, nextWorkspace],
					environments: {
						...state.environments,
						[environmentId]: nextEnvironment,
					},
					activeId: id,
				}));

				return id;
			},

			removeWorkspace: (id) => {
				set((state) => {
					const filtered = state.workspaces.filter((workspace) => workspace.id !== id);
					const nextEnvironments = { ...state.environments };
					for (const environment of Object.values(state.environments)) {
						if (environment.workspaceId === id) {
							delete nextEnvironments[environment.id];
						}
					}
					return {
						workspaces: filtered,
						environments: nextEnvironments,
						activeId:
							state.activeId === id ? (filtered[0]?.id ?? null) : state.activeId,
					};
				});
			},

			toggleSidebar: () =>
				set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

			getActiveWorkspace: () => {
				const { activeId, workspaces } = get();
				return workspaces.find((workspace) => workspace.id === activeId) ?? null;
			},

			getWorkspaceEnvironment: (workspaceId) => {
				const workspace = get().workspaces.find((item) => item.id === workspaceId);
				if (!workspace) return null;
				return get().environments[workspace.primaryEnvironmentId] ?? null;
			},
		}),
		{
			name: 'otto-canvas-workspaces',
			version: 2,
			migrate: (persistedState) => {
				const state = persistedState as Partial<WorkspaceState> | undefined;
				if (!state?.workspaces || !state.environments) {
					return {
						workspaces: [],
						environments: {},
						activeId: null,
						sidebarCollapsed: false,
					};
				}
				return {
					workspaces: state.workspaces,
					environments: state.environments,
					activeId: state.activeId ?? null,
					sidebarCollapsed: state.sidebarCollapsed ?? false,
				};
			},
			partialize: (state) => ({
				workspaces: state.workspaces,
				environments: state.environments,
				activeId: state.activeId,
				sidebarCollapsed: state.sidebarCollapsed,
			}),
		},
	),
);
