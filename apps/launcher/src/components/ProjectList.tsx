import { type TeamState, type ProjectState } from '../lib/tauri';
import { ProjectCard } from './ProjectCard';
import { CopyBlock, BackButton } from './shared';
import { Plus, Upload, KeyRound } from 'lucide-react';
import { useState } from 'react';

interface Props {
	team: TeamState;
	projects: ProjectState[];
	onAdd: () => void;
	onImport: () => void;
	onAction: (projectId: string, action: string) => Promise<void> | void;
	onBack: () => void;
}

export function ProjectList({ team, projects, onAdd, onImport, onAction, onBack }: Props) {
	const [showKey, setShowKey] = useState(false);

	return (
		<div className="px-4 pb-4 space-y-3">
			<BackButton onClick={onBack} label="Home" />

			<div className="flex items-center justify-between mb-1">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">{team.name}</span>
					<span className="text-xs text-muted-foreground">
						{projects.length} {projects.length === 1 ? 'project' : 'projects'}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						onClick={() => setShowKey(!showKey)}
						className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors"
						title="Show deploy key"
					>
						<KeyRound size={11} />
					</button>
					<button
						onClick={onImport}
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-secondary hover:bg-accent transition-colors"
					>
						<Upload size={12} />
						Import
					</button>
					<button
						onClick={onAdd}
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						<Plus size={12} />
						Add Repo
					</button>
				</div>
			</div>

			{showKey && (
				<CopyBlock
					text={team.publicKey}
					label="Deploy key — add to each repo's GitHub settings"
				/>
			)}

			{projects.length === 0 ? (
				<div className="space-y-3 py-6">
					<div className="text-center text-sm text-muted-foreground">
						No projects yet. Add a repo to get started.
					</div>
					<button
						onClick={onAdd}
						className="w-full p-4 border border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-muted-foreground/40 hover:bg-accent/50 transition-colors"
					>
						<Plus size={16} />
						Add your first repository
					</button>
				</div>
			) : (
				projects.map((project) => (
					<ProjectCard
						key={project.id}
						project={project}
						onAction={(action) => onAction(project.id, action)}
					/>
				))
			)}
		</div>
	);
}
