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

export interface WorkspaceEnsureStep {
	id: string;
	label: string;
	run: string;
	cwd?: string;
	when?: {
		pathExists?: string;
		pathMissing?: string;
		commandExists?: string;
	};
}

export interface WorkspaceStartupStep {
	id: string;
	label: string;
	run: string;
	cwd?: string;
	policy: 'manual' | 'onOpen';
}

export interface WorkspaceAutomationConfig {
	ensure: WorkspaceEnsureStep[];
	startup: WorkspaceStartupStep[];
}

interface CreateWorkspaceInput {
	name?: string;
	path: string;
}

interface WorkspaceState {
	workspaces: Workspace[];
	environments: Record<string, Environment>;
	workspaceAutomation: Record<string, WorkspaceAutomationConfig>;
	activeId: string | null;
	sidebarCollapsed: boolean;
	setActive: (id: string) => void;
	addWorkspace: (input: CreateWorkspaceInput) => string;
	removeWorkspace: (id: string) => void;
	setWorkspaceAutomation: (workspaceId: string, config: WorkspaceAutomationConfig) => void;
	toggleSidebar: () => void;
	getActiveWorkspace: () => Workspace | null;
	getWorkspaceEnvironment: (workspaceId: string) => Environment | null;
	getWorkspaceAutomation: (workspaceId: string) => WorkspaceAutomationConfig;
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

function createDefaultWorkspaceAutomation(): WorkspaceAutomationConfig {
	return {
		ensure: [],
		startup: [],
	};
}

export const useWorkspaceStore = create<WorkspaceState>()(
	persist(
		(set, get) => ({
			workspaces: [],
			environments: {},
			workspaceAutomation: {},
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
					workspaceAutomation: {
						...state.workspaceAutomation,
						[id]: createDefaultWorkspaceAutomation(),
					},
					activeId: id,
				}));

				return id;
			},

			removeWorkspace: (id) => {
				set((state) => {
					const filtered = state.workspaces.filter((workspace) => workspace.id !== id);
					const nextEnvironments = { ...state.environments };
					const nextAutomation = { ...state.workspaceAutomation };
					for (const environment of Object.values(state.environments)) {
						if (environment.workspaceId === id) {
							delete nextEnvironments[environment.id];
						}
					}
					delete nextAutomation[id];
					return {
						workspaces: filtered,
						environments: nextEnvironments,
						workspaceAutomation: nextAutomation,
						activeId:
							state.activeId === id ? (filtered[0]?.id ?? null) : state.activeId,
					};
				});
			},

			setWorkspaceAutomation: (workspaceId, config) =>
				set((state) => ({
					workspaceAutomation: {
						...state.workspaceAutomation,
						[workspaceId]: {
							ensure: config.ensure,
							startup: config.startup,
						},
					},
				})),

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

			getWorkspaceAutomation: (workspaceId) =>
				get().workspaceAutomation[workspaceId] ?? createDefaultWorkspaceAutomation(),
		}),
		{
			name: 'otto-canvas-workspaces',
			version: 3,
			migrate: (persistedState) => {
				const state = persistedState as Partial<WorkspaceState> | undefined;
				if (!state?.workspaces || !state.environments) {
					return {
						workspaces: [],
						environments: {},
						workspaceAutomation: {},
						activeId: null,
						sidebarCollapsed: false,
					};
				}
				return {
					workspaces: state.workspaces,
					environments: state.environments,
					workspaceAutomation: state.workspaceAutomation ?? {},
					activeId: state.activeId ?? null,
					sidebarCollapsed: state.sidebarCollapsed ?? false,
				};
			},
			partialize: (state) => ({
				workspaces: state.workspaces,
				environments: state.environments,
				workspaceAutomation: state.workspaceAutomation,
				activeId: state.activeId,
				sidebarCollapsed: state.sidebarCollapsed,
			}),
		},
	),
);
