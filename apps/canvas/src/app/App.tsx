import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { useCanvasKeybinds } from '../hooks/useCanvasKeybinds';
import { useCanvasNativeBlockManager } from '../hooks/useCanvasNativeBlockManager';
import { isTauriRuntime } from '../lib/ghostty';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

export function App() {
	const activeId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const active = workspaces.find((w) => w.id === activeId);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const setFocused = useCanvasStore((s) => s.setFocused);

	useCanvasKeybinds();
	useCanvasNativeBlockManager();

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
						{active && (
							<span className="text-[13px] font-semibold text-canvas-text">
								{active.name}
							</span>
						)}
					</div>
					<div className="ml-auto flex items-center gap-2 pr-3">
						<span className="text-[11px] text-canvas-text-muted">⌘⇧N</span>
					</div>
				</div>

				<div className="min-h-0 flex-1 pr-1 pb-1">
					<div
						className="h-full overflow-hidden rounded-xl border border-white/[0.08] backdrop-blur-xl"
						style={{ background: 'rgba(14, 14, 16, 0.65)' }}
					>
						<CanvasRenderer />
					</div>
				</div>
			</div>
		</div>
	);
}
