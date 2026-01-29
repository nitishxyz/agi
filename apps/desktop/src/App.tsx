import { useState, useEffect } from 'react';
import { useProjects } from './hooks/useProjects';
import { useGitHub } from './hooks/useGitHub';
import { useServer } from './hooks/useServer';
import type { Project } from './lib/tauri-bridge';
import './index.css';

type View = 'picker' | 'workspace';

const SetuLogo = ({ size = 24 }: { size?: number }) => (
	<span
		className="inline-flex items-center justify-center text-foreground"
		style={{ width: size, height: size }}
		// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG logo is hardcoded trusted content
		dangerouslySetInnerHTML={{
			__html: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M55.0151 11H45.7732C42.9871 11 41.594 11 40.5458 11.7564C39.4977 12.5128 39.0587 13.8349 38.1807 16.479L28.4934 45.6545C26.899 50.4561 26.1019 52.8569 27.2993 54.5162C28.4967 56.1754 31.0264 56.1754 36.0858 56.1754H38.1307C41.9554 56.1754 43.8677 56.1754 45.0206 57.2527C45.2855 57.5002 45.5155 57.7825 45.7043 58.092C46.5262 59.4389 46.1395 61.3117 45.3662 65.0574C42.291 79.9519 40.7534 87.3991 43.0079 88.8933C43.4871 89.2109 44.0292 89.4215 44.5971 89.5107C47.2691 89.9303 51.1621 83.398 58.9481 70.3336L70.7118 50.5949C72.8831 46.9517 73.9687 45.13 73.6853 43.639C73.5201 42.7697 73.0712 41.9797 72.4091 41.3927C71.2734 40.386 69.1528 40.386 64.9115 40.386C61.2258 40.386 59.3829 40.386 58.2863 39.5068C57.6438 38.9916 57.176 38.2907 56.9467 37.4998C56.5553 36.1498 57.2621 34.4479 58.6757 31.044L62.4033 22.0683C64.4825 17.0618 65.5221 14.5585 64.3345 12.7793C63.1468 11 60.4362 11 55.0151 11Z" fill="currentColor"/>
</svg>`,
		}}
	/>
);

const GitHubLogo = ({ size = 24 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		className="text-foreground"
	>
		<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
	</svg>
);

function formatTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

function ProjectPicker({
	onSelectProject,
}: {
	onSelectProject: (project: Project) => void;
}) {
	const { projects, loading, openProjectDialog, removeProject, togglePinned } =
		useProjects();
	const {
		user,
		isAuthenticated,
		saveToken,
		logout,
		loadRepos,
		repos,
		cloneRepo,
	} = useGitHub();
	const [showCloneModal, setShowCloneModal] = useState(false);
	const [showTokenInput, setShowTokenInput] = useState(false);
	const [tokenInput, setTokenInput] = useState('');
	const [clonePath] = useState('');
	const [cloning, setCloning] = useState(false);

	const handleOpenFolder = async () => {
		const project = await openProjectDialog();
		if (project) {
			onSelectProject(project);
		}
	};

	const handleCloneClick = async () => {
		if (!isAuthenticated) {
			setShowTokenInput(true);
		} else {
			setShowCloneModal(true);
			await loadRepos();
		}
	};

	const handleCloneRepo = async (url: string, name: string) => {
		const homeDir = '~/Projects';
		const targetPath = clonePath || `${homeDir}/${name}`;
		try {
			setCloning(true);
			await cloneRepo(url, targetPath);
			setShowCloneModal(false);
			const project: Project = {
				path: targetPath,
				name,
				lastOpened: new Date().toISOString(),
				pinned: false,
			};
			onSelectProject(project);
		} catch (err) {
			alert(`Clone failed: ${err}`);
		} finally {
			setCloning(false);
		}
	};

	const handleSaveToken = async () => {
		try {
			await saveToken(tokenInput);
			setShowTokenInput(false);
			setTokenInput('');
		} catch {
			alert('Invalid token');
		}
	};

	const pinnedProjects = projects.filter((p) => p.pinned);
	const recentProjects = projects.filter((p) => !p.pinned);

	return (
		<div className="min-h-screen flex flex-col bg-background text-foreground">
			{/* Top Bar */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-border">
				<div className="flex items-center gap-3">
					<SetuLogo size={24} />
					<span className="font-semibold text-foreground">AGI Desktop</span>
				</div>
				{isAuthenticated && (
					<div className="flex items-center gap-3">
						{user?.avatarUrl && (
							<img
								src={user.avatarUrl}
								alt=""
								className="w-6 h-6 rounded-full"
							/>
						)}
						<span className="text-sm text-muted-foreground">{user?.login}</span>
						<button
							type="button"
							onClick={logout}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 hover:bg-muted rounded"
						>
							Disconnect
						</button>
					</div>
				)}
			</div>

			{/* Main Content */}
			<div className="flex-1 px-6 py-8 lg:px-12 lg:py-12">
				<div className="max-w-4xl mx-auto">
					{/* Header */}
					<div className="mb-10">
						<h1 className="text-3xl lg:text-4xl font-semibold text-foreground mb-3">
							Welcome to AGI
						</h1>
						<p className="text-lg text-muted-foreground max-w-2xl">
							AI-powered development assistant. Open a folder or clone a
							repository to get started.
						</p>
					</div>

					{/* Actions */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
						<button
							type="button"
							onClick={handleOpenFolder}
							className="flex items-center gap-4 p-5 bg-card border border-border hover:border-ring rounded-xl transition-colors text-left"
						>
							<div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
								📁
							</div>
							<div>
								<div className="font-medium text-foreground">Open Folder</div>
								<div className="text-sm text-muted-foreground">
									Open a local project directory
								</div>
							</div>
						</button>

						<button
							type="button"
							onClick={handleCloneClick}
							className="flex items-center gap-4 p-5 bg-card border border-border hover:border-ring rounded-xl transition-colors text-left"
						>
							<div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
								<GitHubLogo size={24} />
							</div>
							<div>
								<div className="font-medium text-foreground">
									{isAuthenticated ? 'Clone from GitHub' : 'Connect GitHub'}
								</div>
								<div className="text-sm text-muted-foreground">
									{isAuthenticated
										? 'Clone a repository'
										: 'Sign in to clone repositories'}
								</div>
							</div>
						</button>
					</div>

					{/* Projects */}
					<div className="space-y-8">
						{pinnedProjects.length > 0 && (
							<div>
								<h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
									<span className="text-yellow-500">⭐</span> Pinned
								</h2>
								<div className="space-y-2">
									{pinnedProjects.map((project) => (
										<div
											key={project.path}
											className="group flex items-center gap-3 p-3 bg-card border border-border hover:border-ring rounded-xl transition-colors"
										>
											<button
												type="button"
												onClick={() => onSelectProject(project)}
												className="flex-1 flex items-center gap-3 text-left"
											>
												<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
													<span className="text-lg">📂</span>
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-foreground truncate">
														{project.name}
													</div>
													<div className="text-xs text-muted-foreground truncate">
														{project.path}
													</div>
												</div>
												<div className="text-xs text-muted-foreground">
													{formatTimeAgo(project.lastOpened)}
												</div>
											</button>
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													type="button"
													onClick={() => togglePinned(project.path)}
													className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
													title="Unpin"
												>
													⭐
												</button>
												<button
													type="button"
													onClick={() => removeProject(project.path)}
													className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
													title="Remove"
												>
													✕
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{recentProjects.length > 0 && (
							<div>
								<h2 className="font-semibold text-foreground mb-4">Recent</h2>
								<div className="space-y-2">
									{recentProjects.map((project) => (
										<div
											key={project.path}
											className="group flex items-center gap-3 p-3 bg-card border border-border hover:border-ring rounded-xl transition-colors"
										>
											<button
												type="button"
												onClick={() => onSelectProject(project)}
												className="flex-1 flex items-center gap-3 text-left"
											>
												<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
													<span className="text-lg">📂</span>
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-foreground truncate">
														{project.name}
													</div>
													<div className="text-xs text-muted-foreground truncate">
														{project.path}
													</div>
												</div>
												<div className="text-xs text-muted-foreground">
													{formatTimeAgo(project.lastOpened)}
												</div>
											</button>
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													type="button"
													onClick={() => togglePinned(project.path)}
													className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
													title="Pin"
												>
													☆
												</button>
												<button
													type="button"
													onClick={() => removeProject(project.path)}
													className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
													title="Remove"
												>
													✕
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{loading && projects.length === 0 && (
							<div className="text-center py-12 text-muted-foreground">
								Loading...
							</div>
						)}

						{!loading && projects.length === 0 && (
							<div className="text-center py-12 text-muted-foreground">
								No recent projects. Open a folder to get started.
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Token Input Modal */}
			{showTokenInput && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
					onClick={() => setShowTokenInput(false)}
				>
					<div
						className="bg-background border border-border rounded-xl w-full max-w-md mx-6 shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-6 border-b border-border">
							<h3 className="text-lg font-semibold text-foreground">
								Connect GitHub
							</h3>
						</div>
						<div className="p-6">
							<p className="text-sm text-muted-foreground mb-4">
								Create a{' '}
								<a
									href="https://github.com/settings/tokens/new?scopes=repo,user"
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline hover:no-underline"
								>
									Personal Access Token
								</a>{' '}
								with{' '}
								<code className="px-1.5 py-0.5 bg-muted rounded text-xs">
									repo
								</code>{' '}
								and{' '}
								<code className="px-1.5 py-0.5 bg-muted rounded text-xs">
									user
								</code>{' '}
								scopes.
							</p>
							<input
								type="password"
								placeholder="ghp_..."
								value={tokenInput}
								onChange={(e) => setTokenInput(e.target.value)}
								autoFocus
								className="w-full h-11 px-4 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono text-sm"
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleSaveToken();
									if (e.key === 'Escape') setShowTokenInput(false);
								}}
							/>
						</div>
						<div className="flex gap-3 p-6 pt-0">
							<button
								type="button"
								onClick={() => setShowTokenInput(false)}
								className="flex-1 h-11 px-4 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSaveToken}
								disabled={!tokenInput}
								className="flex-1 h-11 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
							>
								Connect
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Clone Modal */}
			{showCloneModal && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
					onClick={() => setShowCloneModal(false)}
				>
					<div
						className="bg-background border border-border rounded-xl w-full max-w-2xl mx-6 shadow-2xl max-h-[80vh] flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between p-6 border-b border-border">
							<h3 className="text-lg font-semibold text-foreground">
								Clone from GitHub
							</h3>
							<button
								type="button"
								onClick={() => setShowCloneModal(false)}
								className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
							>
								✕
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-6">
							{repos.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									Loading repositories...
								</div>
							) : (
								<div className="space-y-2">
									{repos.map((repo) => (
										<div
											key={repo.id}
											className="flex items-center justify-between p-4 bg-card border border-border hover:border-ring rounded-xl transition-colors"
										>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<span>{repo.private ? '🔒' : '📦'}</span>
													<span className="font-medium text-foreground truncate">
														{repo.fullName}
													</span>
												</div>
												{repo.description && (
													<div className="text-sm text-muted-foreground truncate">
														{repo.description}
													</div>
												)}
											</div>
											<button
												type="button"
												onClick={() => handleCloneRepo(repo.cloneUrl, repo.name)}
												disabled={cloning}
												className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
											>
												Clone
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Workspace({
	project,
	onBack,
}: {
	project: Project;
	onBack: () => void;
}) {
	const { server, loading, error, startServer, stopServer } = useServer();

	useEffect(() => {
		startServer(project.path);
		return () => {
			stopServer();
		};
	}, [project.path]);

	return (
		<div className="h-screen flex flex-col bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center gap-4 px-4 py-3 border-b border-border">
				<button
					type="button"
					onClick={onBack}
					className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
				>
					←
				</button>
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-foreground truncate">
						{project.name}
					</div>
					<div className="text-xs text-muted-foreground truncate">
						{project.path}
					</div>
				</div>
				{server && (
					<div className="flex items-center gap-2 text-sm">
						<span className="w-2 h-2 rounded-full bg-green-500" />
						<span className="text-muted-foreground">Port {server.webPort}</span>
						<button
							type="button"
							onClick={stopServer}
							className="px-3 py-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
						>
							Stop
						</button>
					</div>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 flex items-center justify-center">
				{loading && (
					<div className="text-center">
						<div className="text-muted-foreground mb-2">Starting server...</div>
					</div>
				)}
				{error && (
					<div className="text-center max-w-md">
						<div className="text-destructive mb-4">{error}</div>
						<button
							type="button"
							onClick={() => startServer(project.path)}
							className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
						>
							Retry
						</button>
					</div>
				)}
				{server && (
					<iframe
						src={server.url}
						className="w-full h-full border-none"
						title="AGI Workspace"
					/>
				)}
			</div>
		</div>
	);
}

function App() {
	const [view, setView] = useState<View>('picker');
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);

	useEffect(() => {
		document.documentElement.classList.add('dark');
	}, []);

	const handleSelectProject = (project: Project) => {
		setSelectedProject(project);
		setView('workspace');
	};

	const handleBack = () => {
		setView('picker');
		setSelectedProject(null);
	};

	return (
		<>
			{view === 'picker' && (
				<ProjectPicker onSelectProject={handleSelectProject} />
			)}
			{view === 'workspace' && selectedProject && (
				<Workspace project={selectedProject} onBack={handleBack} />
			)}
		</>
	);
}

export default App;
