import { listen } from '@tauri-apps/api/event';
import { LoaderCircle, Upload } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { Sidebar } from '../components/Sidebar';
import { useCanvasKeybinds } from '../hooks/useCanvasKeybinds';
import { useCanvasNativeBlockManager } from '../hooks/useCanvasNativeBlockManager';
import { isTauriRuntime } from '../lib/ghostty';
import {
	buildOttoWorkspaceFile,
	getOttoWorkspaceFilePath,
	parseOttoWorkspaceFile,
	stringifyOttoWorkspaceFile,
} from '../lib/otto-workspace-file';
import {
	readWorkspaceFile,
	workspaceFileExists,
	writeWorkspaceFile,
} from '../lib/otto-workspace-io';
import type { WorkspaceSurfaceState } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceRuntimeStore } from '../stores/workspace-runtime-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function isBlankWorkspaceSurface(workspaceSurface: WorkspaceSurfaceState | null) {
	if (!workspaceSurface) return true;
	if (workspaceSurface.tabOrder.length !== 1) return false;
	const onlyTab = workspaceSurface.tabs[workspaceSurface.tabOrder[0]];
	if (!onlyTab || onlyTab.kind !== 'canvas') return false;
	return (
		onlyTab.layout === null &&
		onlyTab.focusedBlockId === null &&
		Object.keys(onlyTab.blocks).length === 0
	);
}

function workspaceSurfaceHasOttoBlocks(workspaceSurface: WorkspaceSurfaceState | null) {
	if (!workspaceSurface) return false;
	return workspaceSurface.tabOrder.some((tabId) => {
		const tab = workspaceSurface.tabs[tabId];
		if (!tab) return false;
		if (tab.kind === 'canvas') {
			return Object.values(tab.blocks).some((block) => block.type === 'otto');
		}
		if (tab.kind === 'block') {
			return tab.block.type === 'otto';
		}
		return false;
	});
}

export function App() {
	const activeId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const environments = useWorkspaceStore((s) => s.environments);
	const active = workspaces.find((w) => w.id === activeId);
	const activeEnvironment = active
		? environments[active.primaryEnvironmentId] ?? null
		: null;
	const activateWorkspace = useCanvasStore((s) => s.activateWorkspace);
	const replaceWorkspaceState = useCanvasStore((s) => s.replaceWorkspaceState);
	const workspaceStates = useCanvasStore((s) => s.workspaceStates);
	const deleteWorkspaceState = useCanvasStore((s) => s.deleteWorkspaceState);
	const activeTabId = useCanvasStore((s) => s.activeTabId);
	const tabs = useCanvasStore((s) => s.tabs);
	const workspaceAutomation = useWorkspaceStore((s) => s.workspaceAutomation);
	const setWorkspaceAutomation = useWorkspaceStore((s) => s.setWorkspaceAutomation);
	const runtimes = useWorkspaceRuntimeStore((s) => s.runtimes);
	const ensureRuntimeStarted = useWorkspaceRuntimeStore((s) => s.ensureStarted);
	const stopRuntime = useWorkspaceRuntimeStore((s) => s.stopRuntime);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const closeBlockSurfaceById = useCanvasStore((s) => s.closeBlockSurfaceById);
	const canvasActiveWorkspaceId = useCanvasStore((s) => s.activeWorkspaceId);
	const activeTab = activeTabId ? tabs[activeTabId] ?? null : null;
	const [workspaceFileExistsState, setWorkspaceFileExistsState] = useState(false);
	const [workspaceFileBusy, setWorkspaceFileBusy] = useState(false);
	const [workspaceFileMessage, setWorkspaceFileMessage] = useState<string | null>(null);
	const [workspaceLoadingState, setWorkspaceLoadingState] = useState<{
		workspaceId: string;
		message: string;
	} | null>(null);
	const autoLoadedWorkspaceIdsRef = useRef(new Set<string>());
	const activeWorkspaceSurface = activeId ? workspaceStates[activeId] ?? null : null;
	const shouldAutoLoadWorkspaceFile = isBlankWorkspaceSurface(activeWorkspaceSurface);
	const activeRuntime = activeId ? runtimes[activeId] ?? null : null;
	const activeWorkspaceHasOttoBlocks = workspaceSurfaceHasOttoBlocks(activeWorkspaceSurface);
	const isWorkspaceActivating = Boolean(activeId && canvasActiveWorkspaceId !== activeId);
	const workspaceRuntimeStarting =
		Boolean(activeId) &&
		activeWorkspaceHasOttoBlocks &&
		(!activeRuntime ||
			activeRuntime.status === 'starting' ||
			activeRuntime.status === 'stopped');
	const activeWorkspaceLoadingMessage = isWorkspaceActivating
		? 'Switching workspace…'
		: workspaceLoadingState?.workspaceId === activeId
			? workspaceLoadingState.message
			: workspaceRuntimeStarting
				? 'Starting workspace runtime…'
				: null;
 	const activeWorkspaceAutomation = activeId
 		? workspaceAutomation[activeId] ?? { ensure: [], startup: [] }
 		: { ensure: [], startup: [] };

	useCanvasKeybinds();
	useCanvasNativeBlockManager();

	useLayoutEffect(() => {
		activateWorkspace(activeId);
	}, [activateWorkspace, activeId]);

	useEffect(() => {
		if (!activeEnvironment?.path) {
			setWorkspaceFileExistsState(false);
			setWorkspaceFileMessage(null);
			return;
		}

		let cancelled = false;
		void workspaceFileExists(activeEnvironment.path)
			.then((value) => {
				if (cancelled) return;
				setWorkspaceFileExistsState(value);
			})
			.catch(() => {
				if (cancelled) return;
				setWorkspaceFileExistsState(false);
			});

		return () => {
			cancelled = true;
		};
	}, [activeEnvironment?.path]);

	useEffect(() => {
		if (!activeId) {
			setWorkspaceLoadingState(null);
			return;
		}
		if (!activeId || !activeEnvironment?.path || !shouldAutoLoadWorkspaceFile) return;
		if (autoLoadedWorkspaceIdsRef.current.has(activeId)) return;

		let cancelled = false;
		setWorkspaceLoadingState({
			workspaceId: activeId,
			message: 'Loading workspace…',
		});
		autoLoadedWorkspaceIdsRef.current.add(activeId);
		const workspaceId = activeId;
		void workspaceFileExists(activeEnvironment.path)
			.then(async (exists) => {
				if (cancelled) return;
				if (!exists) {
					setWorkspaceLoadingState((current) =>
						current?.workspaceId === workspaceId ? null : current,
					);
					return;
				}
				setWorkspaceLoadingState({
					workspaceId,
					message: 'Loading otto.yaml…',
				});
				const content = await readWorkspaceFile(activeEnvironment.path);
				if (cancelled) return;
				const parsed = parseOttoWorkspaceFile(content);
				replaceWorkspaceState(workspaceId, parsed.surfaceState);
				activateWorkspace(workspaceId);
				setWorkspaceAutomation(workspaceId, parsed.automation);
				setWorkspaceFileExistsState(true);
				setWorkspaceFileMessage('Detected and loaded otto.yaml');
				setWorkspaceLoadingState((current) =>
					current?.workspaceId === workspaceId ? null : current,
				);
			})
			.catch((error) => {
				if (cancelled) return;
				setWorkspaceFileMessage(error instanceof Error ? error.message : String(error));
				setWorkspaceLoadingState((current) =>
					current?.workspaceId === workspaceId ? null : current,
				);
			});

		return () => {
			cancelled = true;
			setWorkspaceLoadingState((current) =>
				current?.workspaceId === workspaceId ? null : current,
			);
		};
	}, [
		activeEnvironment?.path,
		activeId,
		shouldAutoLoadWorkspaceFile,
		activateWorkspace,
		replaceWorkspaceState,
		setWorkspaceAutomation,
	]);

	const handleExportWorkspaceFile = useCallback(async () => {
		if (!active || !activeEnvironment || !activeWorkspaceSurface) return;
		setWorkspaceFileBusy(true);
		setWorkspaceFileMessage(null);
		try {
			const file = buildOttoWorkspaceFile({
				workspace: active,
				surfaceState: activeWorkspaceSurface,
				automation: activeWorkspaceAutomation,
			});
			await writeWorkspaceFile(activeEnvironment.path, stringifyOttoWorkspaceFile(file));
			setWorkspaceFileExistsState(true);
			setWorkspaceFileMessage(`Exported ${getOttoWorkspaceFilePath(activeEnvironment.path)}`);
		} catch (error) {
			setWorkspaceFileMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setWorkspaceFileBusy(false);
		}
	}, [active, activeEnvironment, activeWorkspaceAutomation, activeWorkspaceSurface]);

	useEffect(() => {
		const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
		for (const workspaceId of Object.keys(workspaceStates)) {
			if (!workspaceIds.has(workspaceId)) {
				deleteWorkspaceState(workspaceId);
			}
		}
		for (const workspaceId of Object.keys(runtimes)) {
			if (!workspaceIds.has(workspaceId)) {
				void stopRuntime(workspaceId).catch(() => undefined);
			}
		}
	}, [deleteWorkspaceState, runtimes, stopRuntime, workspaceStates, workspaces]);

	useEffect(() => {
		if (!isTauriRuntime() || !active || !activeEnvironment) return;
		void ensureRuntimeStarted({
			workspaceId: active.id,
			environmentId: activeEnvironment.id,
			projectPath: activeEnvironment.path,
		}).catch(() => undefined);
	}, [active, activeEnvironment, ensureRuntimeStarted]);

	useEffect(() => {
		if (!isTauriRuntime()) return;

		let unlistenClose: (() => void) | undefined;
		let unlistenFocus: (() => void) | undefined;

		void listen<{ blockId: string }>('ghostty-close-block', (event) => {
			closeBlockSurfaceById(event.payload.blockId);
			window.setTimeout(() => {
				window.focus();
			}, 0);
		}).then((dispose) => {
			unlistenClose = dispose;
		});

		void listen<{ blockId: string }>('ghostty-focus-block', (event) => {
			setFocused(event.payload.blockId);
		}).then((dispose) => {
			unlistenFocus = dispose;
		});

		return () => {
			unlistenClose?.();
			unlistenFocus?.();
		};
	}, [closeBlockSurfaceById, setFocused]);

	return (
		<div
			className="flex h-screen w-screen"
			style={{ background: 'rgba(14, 14, 16, 0.82)' }}
		>
			<Sidebar />

			<div className="flex min-w-0 flex-1 flex-col pt-1">
				<div
					className="flex h-[36px] flex-shrink-0 items-center px-3"
					data-tauri-drag-region
				>
					{active ? (
						<>
							<div className="flex min-w-0 items-center gap-2">
								<span className="truncate text-[12px] font-semibold tracking-[-0.01em] text-canvas-text">
									{active.name}
								</span>
								{activeEnvironment ? (
									<span className="truncate text-[11px] text-canvas-text-muted">
										{activeEnvironment.path}
									</span>
								) : null}
							</div>
							<div className="ml-auto flex items-center gap-2">
								{workspaceFileMessage ? (
									<span className="max-w-[260px] truncate text-[10px] text-canvas-text-muted">
										{workspaceFileMessage}
									</span>
								) : workspaceFileExistsState ? (
									<span className="text-[10px] text-canvas-text-muted">otto.yaml detected</span>
								) : null}
								<button
									onClick={() => void handleExportWorkspaceFile()}
									disabled={!activeEnvironment || workspaceFileBusy}
									className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] text-canvas-text-muted transition-colors hover:bg-white/[0.08] hover:text-canvas-text disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Upload size={11} />
									Export
								</button>
								{activeTab ? (
									<span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-canvas-text-muted">
										{activeTab.title}
									</span>
								) : null}
							</div>
						</>
					) : (
						<span className="text-[12px] font-medium text-canvas-text-dim">
							Open a workspace
						</span>
					)}
				</div>

				<div className="min-h-0 flex-1 pr-1 pb-1">
					<div
						className="relative h-full overflow-hidden rounded-xl border border-white/[0.08] backdrop-blur-xl"
						style={{ background: 'rgba(14, 14, 16, 0.65)' }}
					>
						<CanvasRenderer />
						{activeWorkspaceLoadingMessage ? (
							<div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center p-6">
								<div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/55 px-3 py-1.5 text-[11px] text-canvas-text shadow-lg backdrop-blur-md">
									<LoaderCircle size={13} className="animate-spin text-canvas-accent" />
									<span>{activeWorkspaceLoadingMessage}</span>
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
