import type { Project } from '../lib/tauri-bridge';
import { formatTimeAgo } from '../utils/format-time';

export function ProjectCard({
	project,
	pinned,
	onSelect,
	onTogglePin,
	onRemove,
}: {
	project: Project;
	pinned: boolean;
	onSelect: () => void;
	onTogglePin: () => void;
	onRemove: () => void;
}) {
	return (
		<button
			type="button"
			className="group flex items-center gap-3 p-3 bg-card border border-border hover:border-ring rounded-xl transition-colors cursor-pointer w-full text-left"
			onClick={onSelect}
		>
			<div className="flex-1 flex items-center gap-3 text-left">
				<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
					<span className="text-lg">{project.remoteUrl ? '🔗' : '📂'}</span>
				</div>
				<div className="flex-1 min-w-0">
					<div className="font-medium text-foreground truncate">
						{project.name}
					</div>
					<div className="text-xs text-muted-foreground truncate">
						{project.remoteUrl || project.path}
					</div>
				</div>
				<div className="text-xs text-muted-foreground">
					{formatTimeAgo(project.lastOpened)}
				</div>
			</div>
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onTogglePin();
					}}
					className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
					title={pinned ? 'Unpin' : 'Pin'}
				>
					{pinned ? '⭐' : '☆'}
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
					title="Remove"
				>
					✕
				</button>
			</div>
		</button>
	);
}
