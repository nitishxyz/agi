import { Sidebar } from '../components/Sidebar';
import { CanvasRenderer } from '../components/CanvasRenderer';
import { useCanvasKeybinds } from '../hooks/useCanvasKeybinds';
import { useWorkspaceStore } from '../stores/workspace-store';

export function App() {
	const activeId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const active = workspaces.find((w) => w.id === activeId);

	useCanvasKeybinds();

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
