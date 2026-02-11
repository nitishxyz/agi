import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { ProjectCard } from './ProjectCard';
import { CopyBlock, BackButton } from './shared';
import { Plus, Upload, KeyRound } from 'lucide-react';

export function ProjectList() {
	const selectedTeam = useStore((s) => s.selectedTeam);
	const projects = useStore((s) => s.projects);
	const teamProjects = selectedTeam
		? projects.filter((p) => p.teamId === selectedTeam.id)
		: [];
	const handleAction = useStore((s) => s.handleAction);
	const selectTeam = useStore((s) => s.selectTeam);
	const setView = useStore((s) => s.setView);
	const refreshStatuses = useStore((s) => s.refreshStatuses);
	const [showKey, setShowKey] = useState(false);

	useEffect(() => {
		refreshStatuses();
	}, [refreshStatuses]);

	if (!selectedTeam) return null;

	return (
		<div className="px-4 pb-4 space-y-3">
			<BackButton onClick={() => selectTeam(null)} label="Home" />

			<div className="flex items-center justify-between mb-1">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">{selectedTeam.name}</span>
					<span className="text-xs text-muted-foreground">
						{teamProjects.length}{' '}
						{teamProjects.length === 1 ? 'project' : 'projects'}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => setShowKey(!showKey)}
						className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors"
						title="Show deploy key"
					>
						<KeyRound size={11} />
					</button>
					<button
						type="button"
						onClick={() => setView('import')}
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-secondary hover:bg-accent transition-colors"
					>
						<Upload size={12} />
						Import
					</button>
					<button
						type="button"
						onClick={() => setView('add-project')}
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						<Plus size={12} />
						Add Repo
					</button>
				</div>
			</div>

			{showKey && (
				<CopyBlock
					text={selectedTeam.publicKey}
					label="Deploy key — add to each repo's GitHub settings"
				/>
			)}

			{teamProjects.length === 0 ? (
				<div className="space-y-3 py-6">
					<div className="text-center text-sm text-muted-foreground">
						No projects yet. Add a repo to get started.
					</div>
					<button
						type="button"
						onClick={() => setView('add-project')}
						className="w-full p-4 border border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-muted-foreground/40 hover:bg-accent/50 transition-colors"
					>
						<Plus size={16} />
						Add your first repository
					</button>
				</div>
			) : (
				teamProjects.map((project) => (
					<ProjectCard
						key={project.id}
						project={project}
						onAction={(action) => handleAction(project.id, action)}
					/>
				))
			)}
		</div>
	);
}
