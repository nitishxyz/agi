import { create } from 'zustand';
import {
	getWorkspaceRuntime,
	readWorkspaceRuntimeLog,
	startWorkspaceRuntime,
	stopWorkspaceRuntime,
	waitForWorkspaceRuntime,
	type WorkspaceRuntimeInfo,
} from '../lib/otto-runtime';

export type WorkspaceRuntimeStatus = 'stopped' | 'starting' | 'ready' | 'error';

export interface WorkspaceRuntimeState {
	workspaceId: string;
	environmentId: string;
	projectPath: string;
	pid?: number;
	port?: number;
	url?: string;
	logPath?: string;
	status: WorkspaceRuntimeStatus;
	error: string | null;
	startedAt?: number;
}

interface EnsureRuntimeInput {
	workspaceId: string;
	environmentId: string;
	projectPath: string;
}

interface WorkspaceRuntimeStore {
	runtimes: Record<string, WorkspaceRuntimeState>;
	ensureStarted: (input: EnsureRuntimeInput) => Promise<WorkspaceRuntimeState>;
	refreshRuntime: (workspaceId: string) => Promise<WorkspaceRuntimeState | null>;
	stopRuntime: (workspaceId: string) => Promise<void>;
}

const pendingStarts = new Map<string, Promise<WorkspaceRuntimeState>>();

function fromRuntimeInfo(
	info: WorkspaceRuntimeInfo,
	status: WorkspaceRuntimeStatus,
	error: string | null = null,
): WorkspaceRuntimeState {
	return {
		workspaceId: info.workspaceId,
		environmentId: info.environmentId,
		projectPath: info.projectPath,
		pid: info.pid,
		port: info.port,
		url: info.url,
		logPath: info.logPath,
		status,
		error,
		startedAt: Date.now(),
	};
}

export const useWorkspaceRuntimeStore = create<WorkspaceRuntimeStore>((set, get) => ({
	runtimes: {},

	ensureStarted: async (input) => {
		const existing = get().runtimes[input.workspaceId];
		if (existing?.status === 'ready' || existing?.status === 'starting') {
			if (existing.status === 'ready') return existing;
			const pending = pendingStarts.get(input.workspaceId);
			if (pending) return pending;
		}

		const pending = (async () => {
			set((state) => ({
				runtimes: {
					...state.runtimes,
					[input.workspaceId]: {
						workspaceId: input.workspaceId,
						environmentId: input.environmentId,
						projectPath: input.projectPath,
						status: 'starting',
						error: null,
					},
				},
			}));

			try {
				const info =
					(await getWorkspaceRuntime(input.workspaceId)) ??
					(await startWorkspaceRuntime(input));
				await waitForWorkspaceRuntime(info.url, { attempts: 120, delayMs: 250 });
				const next = fromRuntimeInfo(info, 'ready');
				set((state) => ({
					runtimes: {
						...state.runtimes,
						[input.workspaceId]: next,
					},
				}));
				return next;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const info = await getWorkspaceRuntime(input.workspaceId);
				let logSnippet = '';
				if (info?.logPath) {
					try {
						const log = await readWorkspaceRuntimeLog(info.logPath);
						if (log.trim()) {
							logSnippet = `\n\nLast runtime log lines:\n${log}`;
						}
					} catch {
						// ignore log read failures
					}
				}
				const next: WorkspaceRuntimeState = {
					workspaceId: input.workspaceId,
					environmentId: input.environmentId,
					projectPath: input.projectPath,
					status: 'error',
					error: `${message}${logSnippet}`,
					logPath: info?.logPath,
				};
				set((state) => ({
					runtimes: {
						...state.runtimes,
						[input.workspaceId]: next,
					},
				}));
				throw error;
			} finally {
				pendingStarts.delete(input.workspaceId);
			}
		})();

		pendingStarts.set(input.workspaceId, pending);
		return pending;
	},

	refreshRuntime: async (workspaceId) => {
		const info = await getWorkspaceRuntime(workspaceId);
		if (!info) {
			set((state) => ({
				runtimes: {
					...state.runtimes,
					[workspaceId]: {
						workspaceId,
						environmentId: state.runtimes[workspaceId]?.environmentId ?? '',
						projectPath: state.runtimes[workspaceId]?.projectPath ?? '',
						status: 'stopped',
						error: null,
					},
				},
			}));
			return null;
		}
		const next = fromRuntimeInfo(info, 'ready');
		set((state) => ({
			runtimes: {
				...state.runtimes,
				[workspaceId]: next,
			},
		}));
		return next;
	},

	stopRuntime: async (workspaceId) => {
		await stopWorkspaceRuntime(workspaceId);
		set((state) => ({
			runtimes: {
				...state.runtimes,
				[workspaceId]: {
					workspaceId,
					environmentId: state.runtimes[workspaceId]?.environmentId ?? '',
					projectPath: state.runtimes[workspaceId]?.projectPath ?? '',
					status: 'stopped',
					error: null,
				},
			},
		}));
	},
}));
