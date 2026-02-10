import { type TeamState, type ProjectState } from '../lib/tauri';
import { KeyRound, Upload, Plus } from 'lucide-react';

interface Props {
	team: TeamState | null;
	projects: ProjectState[];
	onCreateTeam: () => void;
	onImport: () => void;
	onViewTeam: () => void;
}

export function Welcome({ team, projects, onCreateTeam, onImport, onViewTeam }: Props) {
	const running = projects.filter((p) => p.status === 'running').length;

	return (
		<div className="px-4 pb-4 space-y-6">
			<div className="pt-4 text-center space-y-2">
				<div className="text-2xl font-bold tracking-tight">otto</div>
				<div className="text-xs text-muted-foreground">
					Team development environments
				</div>
			</div>

			{team ? (
				<button
					onClick={onViewTeam}
					className="w-full p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left space-y-2"
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
								<KeyRound size={16} className="text-primary" />
							</div>
							<div>
								<div className="text-sm font-medium">{team.name}</div>
								<div className="text-xs text-muted-foreground">
									{team.gitName} &lt;{team.gitEmail}&gt;
								</div>
							</div>
						</div>
						<div className="text-right">
							<div className="text-sm font-medium">{projects.length}</div>
							<div className="text-xs text-muted-foreground">
								{projects.length === 1 ? 'project' : 'projects'}
							</div>
						</div>
					</div>
					{running > 0 && (
						<div className="flex items-center gap-1.5 text-xs text-green-500">
							<div className="w-1.5 h-1.5 rounded-full bg-green-500" />
							{running} running
						</div>
					)}
				</button>
			) : (
				<div className="space-y-3">
					<button
						onClick={onCreateTeam}
						className="w-full p-4 border border-border rounded-lg flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
					>
						<div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
							<Plus size={20} className="text-primary" />
						</div>
						<div>
							<div className="text-sm font-medium">Create Team</div>
							<div className="text-xs text-muted-foreground">
								Generate deploy key and set up team identity
							</div>
						</div>
					</button>

					<button
						onClick={onImport}
						className="w-full p-4 border border-dashed border-border rounded-lg flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
					>
						<div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
							<Upload size={20} className="text-muted-foreground" />
						</div>
						<div>
							<div className="text-sm font-medium">Join Team</div>
							<div className="text-xs text-muted-foreground">
								Import a .otto file from your team admin
							</div>
						</div>
					</button>
				</div>
			)}
		</div>
	);
}
