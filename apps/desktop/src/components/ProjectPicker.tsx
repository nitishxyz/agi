import { useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useGitHub } from '../hooks/useGitHub';
import { useFullscreen } from '../hooks/useFullscreen';
import { handleTitleBarDrag } from '../utils/title-bar';
import { tauriBridge, type Project } from '../lib/tauri-bridge';
import { OttoWordmark, GitHubLogo } from './Icons';
import { ProjectCard } from './ProjectCard';
import { TokenInputModal } from './TokenInputModal';
import { CloneModal } from './CloneModal';
import { Sun, Moon } from 'lucide-react';
import { useDesktopTheme } from '../App';

export function ProjectPicker({
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
	const [cloning, setCloning] = useState(false);
	const isFullscreen = useFullscreen();
	const { theme, toggleTheme } = useDesktopTheme();

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
		const targetPath = `${homeDir}/${name}`;
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

	const pinnedProjects = projects.filter((p) => p.pinned);
	const recentProjects = projects.filter((p) => !p.pinned);

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			<div
				className="shrink-0 flex items-center justify-between px-4 h-10 border-b border-border cursor-default select-none"
				onMouseDown={handleTitleBarDrag}
				data-tauri-drag-region
				role="toolbar"
			>
				<div
					className={`flex items-center gap-2 ${isFullscreen ? '' : 'ml-[68px]'}`}
				>
					<OttoWordmark height={13} className="text-foreground" />
				</div>
				<div className="flex items-center gap-2">
					{isAuthenticated && (
						<div className="flex items-center gap-3 mr-2">
							{user?.avatarUrl && (
								<img
									src={user.avatarUrl}
									alt=""
									className="w-6 h-6 rounded-full"
								/>
							)}
							<span className="text-sm text-muted-foreground">
								{user?.login}
							</span>
							<button
								type="button"
								onClick={logout}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 hover:bg-muted rounded"
							>
								Disconnect
							</button>
						</div>
					)}
					<button
						type="button"
						onClick={toggleTheme}
						className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
						title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
					>
						{theme === 'dark' ? (
							<Sun className="w-3.5 h-3.5" />
						) : (
							<Moon className="w-3.5 h-3.5" />
						)}
					</button>
					<button
						type="button"
						onClick={() => tauriBridge.createNewWindow()}
						className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
						title="New Window"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							aria-hidden="true"
						>
							<rect x="1" y="1" width="14" height="14" rx="2" />
							<line x1="8" y1="4.5" x2="8" y2="11.5" />
							<line x1="4.5" y1="8" x2="11.5" y2="8" />
						</svg>
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-6 py-8 lg:px-12 lg:py-12">
				<div className="max-w-4xl mx-auto">
					<div className="mb-10">
						<h1 className="text-3xl lg:text-4xl font-semibold text-foreground mb-3">
							Welcome to otto
						</h1>
						<p className="text-lg text-muted-foreground max-w-2xl">
							AI-powered development assistant. Open a project or clone a
							repository to get started.
						</p>
					</div>

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
								<div className="font-medium text-foreground">Open Project</div>
								<div className="text-sm text-muted-foreground">
									Open or create a new project
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

					<div className="space-y-8">
						{pinnedProjects.length > 0 && (
							<div>
								<h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
									<span className="text-yellow-500">⭐</span> Pinned
								</h2>
								<div className="space-y-2">
									{pinnedProjects.map((project) => (
										<ProjectCard
											key={project.path}
											project={project}
											pinned={true}
											onSelect={() => onSelectProject(project)}
											onTogglePin={() => togglePinned(project.path)}
											onRemove={() => removeProject(project.path)}
										/>
									))}
								</div>
							</div>
						)}

						{recentProjects.length > 0 && (
							<div>
								<h2 className="font-semibold text-foreground mb-4">Recent</h2>
								<div className="space-y-2">
									{recentProjects.map((project) => (
										<ProjectCard
											key={project.path}
											project={project}
											pinned={false}
											onSelect={() => onSelectProject(project)}
											onTogglePin={() => togglePinned(project.path)}
											onRemove={() => removeProject(project.path)}
										/>
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

			{showTokenInput && (
				<TokenInputModal
					onSave={saveToken}
					onClose={() => setShowTokenInput(false)}
				/>
			)}

			{showCloneModal && (
				<CloneModal
					repos={repos}
					cloning={cloning}
					onClone={handleCloneRepo}
					onClose={() => setShowCloneModal(false)}
				/>
			)}
		</div>
	);
}
