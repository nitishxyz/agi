import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useGitHub } from '../hooks/useGitHub';
import { useFullscreen } from '../hooks/useFullscreen';
import { usePlatform } from '../hooks/usePlatform';
import { handleTitleBarDrag } from '../utils/title-bar';
import { tauriBridge, type Project } from '../lib/tauri-bridge';
import { OttoWordmark, GitHubLogo } from './Icons';
import { ProjectCard } from './ProjectCard';
import { DeviceCodeModal } from './DeviceCodeModal';
import { CloneModal } from './CloneModal';
import { Sun, Moon } from 'lucide-react';
import { ArrowDownToLine, RotateCw } from 'lucide-react';
import { useDesktopTheme } from '../App';
import { WindowControls } from './WindowControls';
import { useUpdate } from '../hooks/useUpdate';

export function ProjectPicker({
	onSelectProject,
}: {
	onSelectProject: (project: Project) => void;
}) {
	const { projects, loading, openProjectDialog, removeProject, togglePinned } =
		useProjects();
	const {
		user,
		loading: githubLoading,
		isAuthenticated,
		oauthState,
		startOAuth,
		startPolling,
		cancelOAuth,
		logout,
		loadRepos,
		repos,
		cloneRepo,
	} = useGitHub();
	const [showCloneModal, setShowCloneModal] = useState(false);
	const [showOAuthModal, setShowOAuthModal] = useState(false);
	const [cloning, setCloning] = useState(false);
	const [cloningRepo, setCloningRepo] = useState<string | null>(null);
	const isFullscreen = useFullscreen();
	const platform = usePlatform();
	const { theme, toggleTheme } = useDesktopTheme();
	const pageRef = useRef(1);
	const {
		available: updateAvailable,
		version: updateVersion,
		downloading,
		downloaded,
		progress: updateProgress,
		downloadUpdate,
		applyUpdate,
	} = useUpdate();

	const handleOpenFolder = async () => {
		const project = await openProjectDialog();
		if (project) {
			onSelectProject(project);
		}
	};

	const handleCloneClick = async () => {
		if (githubLoading) return;
		if (!isAuthenticated) {
			setShowOAuthModal(true);
			await startOAuth();
		} else {
			setShowCloneModal(true);
			pageRef.current = 1;
			await loadRepos(1);
		}
	};

	const handleOAuthCancel = () => {
		cancelOAuth();
		setShowOAuthModal(false);
	};

	const handleStartPolling = (deviceCode: string, interval: number) => {
		startPolling(deviceCode, interval);
	};

	const handleSearch = useCallback(
		async (query: string) => {
			pageRef.current = 1;
			await loadRepos(1, query || undefined);
		},
		[loadRepos],
	);

	const handleLoadMore = useCallback(async () => {
		pageRef.current += 1;
		await loadRepos(pageRef.current);
	}, [loadRepos]);

	const handleCloneRepo = async (url: string, name: string) => {
		const homeDir = '~/Projects';
		const targetPath = `${homeDir}/${name}`;
		try {
			setCloning(true);
			const repoFullName =
				repos.find((r) => r.clone_url === url)?.full_name || name;
			setCloningRepo(repoFullName);
			const resolvedPath = await cloneRepo(url, targetPath);
			setShowCloneModal(false);
			const project: Project = {
				path: resolvedPath,
				name,
				lastOpened: new Date().toISOString(),
				pinned: false,
			};
			onSelectProject(project);
		} catch (err) {
			alert(`Clone failed: ${err}`);
		} finally {
			setCloning(false);
			setCloningRepo(null);
		}
	};

	useEffect(() => {
		if (showOAuthModal && oauthState.step === 'complete' && isAuthenticated) {
			setShowOAuthModal(false);
			setShowCloneModal(true);
			pageRef.current = 1;
			loadRepos(1);
		}
	}, [showOAuthModal, oauthState.step, isAuthenticated, loadRepos]);

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
					className={`flex items-center gap-2 ${isFullscreen || platform === 'linux' ? '' : 'ml-[68px]'}`}
				>
					<OttoWordmark height={13} className="text-foreground" />
				</div>
				<div className="flex items-center gap-2">
					{isAuthenticated && (
						<div className="flex items-center gap-3 mr-2">
							{user?.avatar_url && (
								<img
									src={user.avatar_url}
									alt=""
									className="w-5 h-5 rounded-full"
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
					{updateAvailable &&
						(downloaded ? (
							<button
								type="button"
								onClick={applyUpdate}
								className="h-6 px-2.5 flex items-center gap-1.5 text-xs font-medium bg-green-600 text-white rounded-full hover:bg-green-500 transition-colors"
								title={`Restart to update to v${updateVersion}`}
							>
								<RotateCw className="w-3 h-3" />
								Restart
							</button>
						) : (
							<button
								type="button"
								onClick={downloadUpdate}
								disabled={downloading}
								className="h-6 px-2.5 flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-60"
								title={`Update to v${updateVersion}`}
							>
								<ArrowDownToLine className="w-3 h-3" />
								{downloading ? `${updateProgress}%` : 'Update'}
							</button>
						))}
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
					{platform === 'linux' && <WindowControls />}
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
									{githubLoading
										? 'GitHub'
										: isAuthenticated
											? 'Clone from GitHub'
											: 'Connect GitHub'}
								</div>
								<div className="text-sm text-muted-foreground">
									{githubLoading
										? 'Checking connection...'
										: isAuthenticated
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

			{showOAuthModal && oauthState.step !== 'complete' && (
				<DeviceCodeModal
					oauthState={oauthState}
					onStartPolling={handleStartPolling}
					onCancel={handleOAuthCancel}
				/>
			)}

			{showCloneModal && (
				<CloneModal
					repos={repos}
					cloning={cloning}
					cloningRepo={cloningRepo}
					onClone={handleCloneRepo}
					onClose={() => setShowCloneModal(false)}
					onSearch={handleSearch}
					onLoadMore={handleLoadMore}
				/>
			)}
		</div>
	);
}
