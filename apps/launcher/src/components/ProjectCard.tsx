import { useState } from 'react';
import type { ProjectState } from '../lib/tauri';
import { MenuItem } from './shared';
import {
	Play,
	Square,
	ExternalLink,
	RotateCcw,
	ArrowUpCircle,
	Trash2,
	MoreHorizontal,
	Download,
	Loader2,
	Terminal,
} from 'lucide-react';

interface Props {
	project: ProjectState;
	onAction: (action: string) => Promise<void> | void;
}

export function ProjectCard({ project, onAction }: Props) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [loading, setLoading] = useState<string | null>(null);
	const running = project.status === 'running';
	const repoName =
		project.repo.split('/').pop()?.replace('.git', '') || project.repo;

	const handleAction = async (action: string) => {
		if (action === 'start' || action === 'export') {
			onAction(action);
			return;
		}
		setLoading(action);
		try {
			await onAction(action);
		} finally {
			setLoading(null);
		}
	};

	return (
		<div className="rounded-lg border border-border bg-card p-3 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div
						className={`w-2 h-2 rounded-full ${running ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
					/>
					<span className="text-sm font-medium">{repoName}</span>
				</div>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					{running && <span>:{project.webPort}</span>}
					{loading ? (
						<span className="flex items-center gap-1 text-yellow-500">
							<Loader2 size={10} className="animate-spin" />
							{loading}...
						</span>
					) : (
						<span>{project.status}</span>
					)}
				</div>
			</div>

			<div className="text-xs text-muted-foreground truncate">
				{project.repo}
			</div>

			<div className="flex items-center gap-1.5 pt-1">
				{running ? (
					<>
						<button
							onClick={() => handleAction('open')}
							className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<ExternalLink size={11} />
							Open
						</button>
						<button
							onClick={() => handleAction('manage')}
							className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary hover:bg-accent transition-colors"
						>
							<Terminal size={11} />
							Manage
						</button>
						<button
							onClick={() => handleAction('stop')}
							disabled={!!loading}
							className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary hover:bg-accent transition-colors disabled:opacity-50"
						>
							{loading === 'stop' ? (
								<Loader2 size={11} className="animate-spin" />
							) : (
								<Square size={11} />
							)}
							Stop
						</button>
					</>
				) : (
					<>
						<button
							onClick={() => handleAction('start')}
							disabled={!!loading}
							className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{loading === 'start' ? (
								<Loader2 size={11} className="animate-spin" />
							) : (
								<Play size={11} />
							)}
							Start
						</button>
						<button
							onClick={() => handleAction('manage')}
							className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary hover:bg-accent transition-colors"
						>
							<Terminal size={11} />
							Manage
						</button>
					</>
				)}

				<div className="relative ml-auto">
					<button
						onClick={() => setMenuOpen(!menuOpen)}
						className="p-1 rounded hover:bg-secondary transition-colors"
					>
						<MoreHorizontal size={14} />
					</button>

					{menuOpen && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setMenuOpen(false)}
							/>
							<div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-border bg-popover shadow-lg py-1">
								<MenuItem
									icon={<RotateCcw size={12} />}
									label="Restart otto"
									onClick={() => {
										handleAction('restart');
										setMenuOpen(false);
									}}
								/>
								<MenuItem
									icon={<ArrowUpCircle size={12} />}
									label="Update otto"
									onClick={() => {
										handleAction('update');
										setMenuOpen(false);
									}}
								/>
								<MenuItem
									icon={<Download size={12} />}
									label="Export .otto"
									onClick={() => {
										handleAction('export');
										setMenuOpen(false);
									}}
								/>
								<div className="border-t border-border my-1" />
								<MenuItem
									icon={<Trash2 size={12} />}
									label="Nuke"
									destructive
									onClick={() => {
										handleAction('nuke');
										setMenuOpen(false);
									}}
								/>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
