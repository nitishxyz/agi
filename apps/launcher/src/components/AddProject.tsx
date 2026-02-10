import { useState } from 'react';
import { tauri, type TeamState, type ProjectState, type OttoTeamConfig } from '../lib/tauri';
import { ArrowLeft, Download, Plus } from 'lucide-react';

interface Props {
	team: TeamState;
	existingProjects: ProjectState[];
	onAdd: (project: ProjectState) => void;
	onCancel: () => void;
}

export function AddProject({ team, existingProjects, onAdd, onCancel }: Props) {
	const [repoUrl, setRepoUrl] = useState('');
	const [exportAfter, setExportAfter] = useState(true);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const repoName = repoUrl.split('/').pop()?.replace('.git', '') || '';

	const handleAdd = async () => {
		if (!repoUrl) {
			setError('Repository URL is required');
			return;
		}
		if (!repoUrl.startsWith('git@')) {
			setError('Use SSH URL format: git@github.com:org/repo.git');
			return;
		}

		setLoading(true);
		setError('');

		try {
			const trackedPorts = existingProjects.map((p) => p.apiPort);
			const apiPort = await tauri.findAvailablePort(trackedPorts);
			const name = repoUrl.split('/').pop()?.replace('.git', '') || 'project';

			const project: ProjectState = {
				id: `${name}-${apiPort}`,
				repo: repoUrl,
				containerName: `otto-${name}-${apiPort}`,
				apiPort,
				webPort: apiPort + 1,
				status: 'stopped',
				image: 'oven/bun:1-debian',
				devPorts: 'auto',
				postClone: 'bun install',
				gitName: team.gitName,
				gitEmail: team.gitEmail,
			};

			if (exportAfter) {
				const config: OttoTeamConfig = {
					version: 1,
					repo: repoUrl,
					key: team.encryptedKey,
					cipher: 'aes-256-cbc-pbkdf2',
					gitName: team.gitName,
					gitEmail: team.gitEmail,
					image: project.image,
					devPorts: project.devPorts,
					postClone: project.postClone,
				};
				await tauri.saveOttoFile(config, `${name}.otto`);
			}

			onAdd(project);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add project');
		}
		setLoading(false);
	};

	return (
		<div className="px-4 pb-4 space-y-4">
			<button
				onClick={onCancel}
				className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft size={12} />
				Back
			</button>

			<div className="space-y-3">
				<div className="text-sm font-medium">Add Repository</div>
				<div className="text-xs text-muted-foreground">
					Add a repo for {team.name}. Make sure you've added the
					deploy key to this repo on GitHub.
				</div>

				<div className="space-y-1.5">
					<label className="text-xs text-muted-foreground">
						Repository URL (SSH)
					</label>
					<input
						type="text"
						value={repoUrl}
						onChange={(e) => setRepoUrl(e.target.value)}
						placeholder="git@github.com:org/repo.git"
						className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
						autoFocus
					/>
				</div>

				{repoName && (
					<div className="rounded-md border border-border bg-card p-3 space-y-1">
						<div className="text-xs text-muted-foreground">Container</div>
						<div className="text-sm font-mono">otto-{repoName}</div>
						<div className="text-xs text-muted-foreground mt-1">Git identity</div>
						<div className="text-sm">{team.gitName} &lt;{team.gitEmail}&gt;</div>
					</div>
				)}

				<label className="flex items-center gap-2 text-sm cursor-pointer">
					<input
						type="checkbox"
						checked={exportAfter}
						onChange={(e) => setExportAfter(e.target.checked)}
						className="rounded border-border"
					/>
					<span className="text-xs text-muted-foreground">
						Export .otto file for team sharing
					</span>
				</label>

				{error && <div className="text-xs text-destructive">{error}</div>}

				<button
					onClick={handleAdd}
					disabled={loading || !repoUrl}
					className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
				>
					{exportAfter ? <Download size={14} /> : <Plus size={14} />}
					{loading ? 'Adding...' : exportAfter ? 'Add & Export .otto' : 'Add Project'}
				</button>
			</div>
		</div>
	);
}
