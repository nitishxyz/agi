import { Plus } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace-store';

function getInitials(name: string): string {
	const parts = name.split(/[-_\s]+/);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return name.slice(0, 2).toUpperCase();
}

export function Sidebar() {
	const { workspaces, activeId, setActive, addWorkspace } =
		useWorkspaceStore();

	return (
		<div className="flex flex-col items-center w-[68px] h-full flex-shrink-0">
			<div className="h-[48px] w-full flex-shrink-0" data-tauri-drag-region />

			<div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto py-1 w-full">
				{workspaces.map((ws) => {
					const isActive = ws.id === activeId;
					return (
						<div key={ws.id} className="relative flex items-center justify-center w-full">
							<div
								className={`absolute left-0 w-[4px] rounded-r-full transition-all duration-200 ${
									isActive
										? 'h-[20px] bg-white'
										: 'h-0 group-hover:h-[8px] bg-white/40'
								}`}
							/>
							<button
								onClick={() => setActive(ws.id)}
								className="group relative"
								title={ws.name}
							>
								<div
									className={`w-[44px] h-[44px] flex items-center justify-center text-[14px] font-bold transition-all duration-200 ${
										isActive
											? 'rounded-[14px]'
											: 'rounded-[22px] group-hover:rounded-[14px]'
									}`}
									style={{ backgroundColor: ws.color }}
								>
									<span className="text-white select-none">{getInitials(ws.name)}</span>
								</div>
							</button>
						</div>
					);
				})}

				<div className="w-[36px] h-[1px] bg-white/[0.08] mx-auto my-1 flex-shrink-0" />

				<button
					onClick={() => addWorkspace(`project-${workspaces.length + 1}`)}
					className="group"
					title="Add a workspace"
				>
					<div className="w-[44px] h-[44px] rounded-[22px] group-hover:rounded-[14px] flex items-center justify-center bg-white/[0.06] text-canvas-text-muted group-hover:text-green-400 group-hover:bg-green-400/10 transition-all duration-200">
						<Plus size={20} strokeWidth={1.5} />
					</div>
				</button>
			</div>

			<div className="h-3 flex-shrink-0" />
		</div>
	);
}
