import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { Sidebar } from '../components/Sidebar';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { useCanvasKeybinds } from '../hooks/useCanvasKeybinds';
import { destroyGhosttyBlock, isTauriRuntime, setGhosttyBlockFocus } from '../lib/ghostty';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

export function App() {
	const activeId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const active = workspaces.find((w) => w.id === activeId);
	const blocks = useCanvasStore((s) => s.blocks);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const previousBlocksRef = useRef(blocks);
	const previousFocusedBlockIdRef = useRef<string | null | undefined>(undefined);
	const closedTerminalIdsRef = useRef<Set<string>>(new Set());

	useCanvasKeybinds();

	useEffect(() => {
		if (!isTauriRuntime()) {
			previousBlocksRef.current = blocks;
			return;
		}

		const previousBlocks = previousBlocksRef.current;
		for (const [blockId, block] of Object.entries(previousBlocks)) {
			if (!blocks[blockId] && block.type === 'terminal') {
				if (closedTerminalIdsRef.current.has(blockId)) {
					console.debug('[ghostty] block removed after native close', { blockId });
					closedTerminalIdsRef.current.delete(blockId);
					continue;
				}
				console.debug('[ghostty] destroying removed terminal block', { blockId });
				void destroyGhosttyBlock(blockId);
			}
		}
		previousBlocksRef.current = blocks;
	}, [blocks]);

	useEffect(() => {
		if (!isTauriRuntime()) {
			return;
		}

		let unlistenClose: (() => void) | undefined;
		let unlistenFocus: (() => void) | undefined;

		void listen<{ blockId: string }>('ghostty-close-block', (event) => {
			console.debug('[ghostty] close event received', event.payload);
			closedTerminalIdsRef.current.add(event.payload.blockId);
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

	useEffect(() => {
		if (!isTauriRuntime()) {
			previousFocusedBlockIdRef.current = focusedBlockId;
			return;
		}

		if (previousFocusedBlockIdRef.current === undefined) {
			previousFocusedBlockIdRef.current = focusedBlockId;
			return;
		}

		const previousFocusedBlockId = previousFocusedBlockIdRef.current;
		if (previousFocusedBlockId && previousFocusedBlockId !== focusedBlockId) {
			const previousBlock = blocks[previousFocusedBlockId];
			if (previousBlock?.type === 'terminal') {
				void setGhosttyBlockFocus(previousFocusedBlockId, false);
			}
		}

		if (focusedBlockId) {
			const focusedBlock = blocks[focusedBlockId];
			if (focusedBlock?.type === 'terminal') {
				window.setTimeout(() => {
					void setGhosttyBlockFocus(focusedBlockId, true);
				}, 0);
			}
		}

		previousFocusedBlockIdRef.current = focusedBlockId;
	}, [blocks, focusedBlockId]);

	return (
		<div
			className="flex h-screen w-screen"
			style={{ background: 'transparent' }}
		>
			<Sidebar />

			<div className="flex-1 flex flex-col min-w-0">
				<div
					className="h-[48px] flex items-center flex-shrink-0"
					data-tauri-drag-region
				>
					<div className="flex items-center gap-3 pl-4">
						{active && (
							<span className="text-[13px] font-semibold text-canvas-text">{active.name}</span>
						)}
					</div>
					<div className="ml-auto flex items-center gap-2 pr-3">
						<span className="text-[11px] text-canvas-text-muted">⌘⇧N</span>
					</div>
				</div>

				<div className="flex-1 min-h-0 pr-1 pb-1">
					<div
						className="h-full rounded-xl border border-white/[0.08] overflow-hidden backdrop-blur-xl"
						style={{ background: 'rgba(14, 14, 16, 0.65)' }}
					>
						<CanvasRenderer />
					</div>
				</div>
			</div>
		</div>
	);
}
