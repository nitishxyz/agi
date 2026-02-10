import { useState, useCallback } from 'react';
import { tauri, type ProjectState, type OttoTeamConfig } from '../lib/tauri';
import { Upload, ArrowLeft } from 'lucide-react';

interface Props {
	existingProjects: ProjectState[];
	onImport: (project: ProjectState, password: string) => void;
	onCancel: () => void;
}

export function ImportDialog({ existingProjects, onImport, onCancel }: Props) {
	const [config, setConfig] = useState<OttoTeamConfig | null>(null);
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [verifying, setVerifying] = useState(false);

	const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const parsed = await tauri.parseTeamConfig(content);
			setConfig(parsed);
			setError('');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Invalid config file');
		}
	}, []);

	const handleDrop = useCallback(async (e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (!file) return;

		try {
			const content = await file.text();
			const parsed = await tauri.parseTeamConfig(content);
			setConfig(parsed);
			setError('');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Invalid config file');
		}
	}, []);

	const handleSubmit = async () => {
		if (!config || !password) return;
		setVerifying(true);
		setError('');

		try {
			const valid = await tauri.verifyPassword(config.key, password);
			if (!valid) {
				setError('Wrong password');
				setVerifying(false);
				return;
			}

			const trackedPorts = existingProjects.map((p) => p.apiPort);
			const apiPort = await tauri.findAvailablePort(trackedPorts);
			const repoName = config.repo.split('/').pop()?.replace('.git', '') || 'project';

			const project: ProjectState = {
				id: `${repoName}-${apiPort}`,
				repo: config.repo,
				containerName: `otto-${repoName}-${apiPort}`,
				apiPort,
				webPort: apiPort + 1,
				status: 'creating',
				gitName: config.gitName,
				gitEmail: config.gitEmail,
			};

			onImport(project, password);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Verification failed');
		}
		setVerifying(false);
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

			{!config ? (
				<div
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleDrop}
					className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 hover:border-muted-foreground/40 transition-colors"
				>
					<Upload size={24} className="text-muted-foreground" />
					<span className="text-sm text-muted-foreground">
						Drop .otto file here
					</span>
					<label className="px-3 py-1.5 text-xs rounded bg-secondary hover:bg-accent cursor-pointer transition-colors">
						Browse
						<input
							type="file"
							accept=".otto"
							onChange={handleFile}
							className="hidden"
						/>
					</label>
				</div>
			) : (
				<div className="space-y-3">
					<div className="rounded-lg border border-border bg-card p-3 space-y-2">
						<div className="text-sm font-medium">
							{config.repo.split('/').pop()?.replace('.git', '')}
						</div>
						<div className="text-xs text-muted-foreground">{config.repo}</div>
						<div className="text-xs text-muted-foreground">
							{config.gitName} &lt;{config.gitEmail}&gt;
						</div>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs text-muted-foreground">
							Team password
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
							placeholder="Enter team password"
							className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
							autoFocus
						/>
					</div>

					{error && (
						<div className="text-xs text-destructive">{error}</div>
					)}

					<button
						onClick={handleSubmit}
						disabled={!password || verifying}
						className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					>
						{verifying ? 'Verifying...' : 'Start Setup'}
					</button>
				</div>
			)}
		</div>
	);
}
