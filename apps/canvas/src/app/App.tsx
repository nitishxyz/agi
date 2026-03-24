import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { OttoWorkspaceBoundary } from '../components/OttoWorkspaceBoundary';
import { Sidebar } from '../components/Sidebar';
import { useCanvasKeybinds } from '../hooks/useCanvasKeybinds';
import { useCanvasNativeBlockManager } from '../hooks/useCanvasNativeBlockManager';
import { isTauriRuntime } from '../lib/ghostty';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceRuntimeStore } from '../stores/workspace-runtime-store';
import { useWorkspaceStore } from '../stores/workspace-store';

export function App() {
	const activeId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const environments = useWorkspaceStore((s) => s.environments);
	const active = workspaces.find((w) => w.id === activeId);
	const activeEnvironment = active
		? environments[active.primaryEnvironmentId] ?? null
		: null;
	const activateWorkspace = useCanvasStore((s) => s.activateWorkspace);
	const workspaceStates = useCanvasStore((s) => s.workspaceStates);
	const deleteWorkspaceState = useCanvasStore((s) => s.deleteWorkspaceState);
	const activeTabId = useCanvasStore((s) => s.activeTabId);
	const tabs = useCanvasStore((s) => s.tabs);
	const activeTabKind = useCanvasStore((s) => s.activeTabKind);
	const runtimes = useWorkspaceRuntimeStore((s) => s.runtimes);
	const ensureRuntimeStarted = useWorkspaceRuntimeStore((s) => s.ensureStarted);
	const stopRuntime = useWorkspaceRuntimeStore((s) => s.stopRuntime);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const activeTab = activeTabId ? tabs[activeTabId] ?? null : null;

	useCanvasKeybinds();
	useCanvasNativeBlockManager();

	useEffect(() => {
		activateWorkspace(activeId);
	}, [activateWorkspace, activeId]);

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
			removeBlock(event.payload.blockId);
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
	}, [removeBlock, setFocused]);

	return (
		<div
			className="flex h-screen w-screen"
			style={{ background: 'transparent' }}
		>
			<Sidebar />

			<div className="flex min-w-0 flex-1 flex-col">
				<div
					className="h-[48px] flex items-center flex-shrink-0"
					data-tauri-drag-region
				>
					<div className="flex items-center gap-3 pl-4">
						{active ? (
							<div className="min-w-0">
								<span className="block truncate text-[13px] font-semibold text-canvas-text">
									{active.name}
								</span>
								{activeTab ? (
									<span className="block truncate text-[10px] text-canvas-text-muted">
										{activeTab.title}
										{activeEnvironment ? ` · ${activeEnvironment.path}` : ''}
									</span>
								) : activeEnvironment ? (
									<span className="block truncate text-[10px] text-canvas-text-muted">
										{activeEnvironment.path}
									</span>
								) : null}
							</div>
						) : (
							<span className="text-[13px] font-semibold text-canvas-text-dim">
								Open a workspace
							</span>
						)}
					</div>
					<div className="ml-auto flex items-center gap-2 pr-3">
						{activeTab && (
							<span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
								{activeTabKind === 'canvas'
									? 'Canvas tab'
									: activeTabKind === 'pending'
										? 'New tab'
										: 'Block tab'}
							</span>
						)}
						<span className="text-[11px] text-canvas-text-muted">⌘⇧N</span>
					</div>
				</div>

				<div className="min-h-0 flex-1 pr-1 pb-1">
					<div
						className="h-full overflow-hidden rounded-xl border border-white/[0.08] backdrop-blur-xl"
						style={{ background: 'rgba(14, 14, 16, 0.65)' }}
					>
						<OttoWorkspaceBoundary>
							<CanvasRenderer />
						</OttoWorkspaceBoundary>
					</div>
				</div>
			</div>
		</div>
	);
}
