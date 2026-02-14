import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useGitHub } from '../hooks/useGitHub';
import { usePlatform } from '../hooks/usePlatform';
import { handleTitleBarDrag } from '../utils/title-bar';
import { tauriBridge, type Project } from '../lib/tauri-bridge';
import { OttoWordmark } from './Icons';
import { ProjectCard } from './ProjectCard';
import { DeviceCodeModal } from './DeviceCodeModal';
import { CloneModal } from './CloneModal';
import {
	Sun,
	Moon,
	ArrowDownToLine,
	RotateCw,
	FolderOpen,
	GitBranch,
	Link,
	Star,
} from 'lucide-react';
import { useDesktopTheme } from '../App';
import { WindowControls } from './WindowControls';
import { useUpdate } from '../hooks/useUpdate';
import { useVersion } from '../hooks/useVersion';

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
	const [showConnectModal, setShowConnectModal] = useState(false);
	const [connectUrl, setConnectUrl] = useState('');
	const [connectName, setConnectName] = useState('');
	const [cloning, setCloning] = useState(false);
	const [cloningRepo, setCloningRepo] = useState<string | null>(null);
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
	const appVersion = useVersion();

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

	const handleConnect = () => {
		if (!connectUrl.trim()) return;
		try {
			const url = new URL(connectUrl.trim());
			const name = connectName.trim() || url.hostname;
			const project: Project = {
				path: `remote://${url.host}`,
				name,
				lastOpened: new Date().toISOString(),
				pinned: false,
				remoteUrl: connectUrl.trim(),
			};
			tauriBridge.saveRecentProject(project).catch(() => {});
			setShowConnectModal(false);
			setConnectUrl('');
			setConnectName('');
			onSelectProject(project);
		} catch {
			alert('Invalid URL. Please enter a valid API server URL.');
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
				className="shrink-0 flex items-center px-4 h-10 border-b border-border/50 cursor-default select-none relative"
				onMouseDown={handleTitleBarDrag}
				data-tauri-drag-region
				role="toolbar"
			>
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<OttoWordmark height={13} className="text-foreground" />
				</div>
				<div className="flex items-center gap-2 ml-auto">
					{isAuthenticated && (
					<div className="flex items-center gap-1.5 mr-2">
						{user?.avatar_url && (
							<img
								src={user.avatar_url}
								alt=""
								className="w-4 h-4 rounded-full"
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

			<div className="flex-1 overflow-y-auto">
				<div className="relative min-h-full flex flex-col">
					<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--ring)/0.04),transparent)] pointer-events-none" />

					<div className="relative z-10 flex-1 flex flex-col items-center pt-16 pb-12 px-6">
						<div className="text-center mb-12">
							<OttoWordmark height={32} className="text-foreground mx-auto mb-4" />
							<p className="text-sm text-muted-foreground max-w-sm mx-auto">
								Open-source AI coding assistant
							</p>
							{appVersion && (
								<span className="text-[10px] text-muted-foreground/40 mt-2 block">
									v{appVersion}
								</span>
							)}
						</div>

						<div className="w-full max-w-lg">
							<div className="grid grid-cols-3 gap-2 mb-10">
								<button
									type="button"
									onClick={handleOpenFolder}
									className="group flex flex-col items-center gap-2.5 p-4 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-150 text-center"
								>
									<div className="w-9 h-9 rounded-lg bg-muted/60 group-hover:bg-muted flex items-center justify-center transition-colors">
										<FolderOpen className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
									</div>
									<div>
										<div className="text-xs font-medium text-foreground">Open</div>
										<div className="text-[10px] text-muted-foreground/60 mt-0.5">
											Local project
										</div>
									</div>
								</button>

								<button
									type="button"
									onClick={handleCloneClick}
									className="group flex flex-col items-center gap-2.5 p-4 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-150 text-center"
								>
									<div className="w-9 h-9 rounded-lg bg-muted/60 group-hover:bg-muted flex items-center justify-center transition-colors">
										<GitBranch className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
									</div>
									<div>
										<div className="text-xs font-medium text-foreground">
											{githubLoading
												? 'GitHub'
												: isAuthenticated
													? 'Clone'
													: 'GitHub'}
										</div>
										<div className="text-[10px] text-muted-foreground/60 mt-0.5">
											{githubLoading
												? 'Checking...'
												: isAuthenticated
													? 'From repository'
													: 'Connect & clone'}
										</div>
									</div>
								</button>

								<button
									type="button"
									onClick={() => setShowConnectModal(true)}
									className="group flex flex-col items-center gap-2.5 p-4 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-150 text-center"
								>
									<div className="w-9 h-9 rounded-lg bg-muted/60 group-hover:bg-muted flex items-center justify-center transition-colors">
										<Link className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
									</div>
									<div>
										<div className="text-xs font-medium text-foreground">Connect</div>
										<div className="text-[10px] text-muted-foreground/60 mt-0.5">
											Remote server
										</div>
									</div>
								</button>
							</div>

							{(pinnedProjects.length > 0 || recentProjects.length > 0) && (
								<div className="bg-card/50 border border-border/50 rounded-xl overflow-hidden">
									{pinnedProjects.length > 0 && (
										<div>
											<div className="px-4 pt-3 pb-1">
												<h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
													<Star className="w-3 h-3 text-yellow-500/70" />
													Pinned
												</h2>
											</div>
											<div className="px-1">
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

									{pinnedProjects.length > 0 && recentProjects.length > 0 && (
										<div className="mx-4 border-t border-border/30" />
									)}

									{recentProjects.length > 0 && (
										<div>
											<div className="px-4 pt-3 pb-1">
												<h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
													Recent
												</h2>
											</div>
											<div className="px-1 pb-1">
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
								</div>
							)}

							{loading && projects.length === 0 && (
								<div className="text-center py-16 text-sm text-muted-foreground/60">
									Loading...
								</div>
							)}

							{!loading && projects.length === 0 && (
								<div className="text-center py-16">
									<div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
										<FolderOpen className="w-5 h-5 text-muted-foreground/40" />
									</div>
									<p className="text-sm text-muted-foreground/60">
										No recent projects
									</p>
									<p className="text-xs text-muted-foreground/40 mt-1">
										Open a folder to get started
									</p>
								</div>
							)}
						</div>
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

			{showConnectModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
						<h2 className="text-sm font-semibold text-foreground mb-4">
							Connect to Server
						</h2>
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-muted-foreground mb-1.5">
									API Server URL
								</label>
								<input
									type="url"
									value={connectUrl}
									onChange={(e) => setConnectUrl(e.target.value)}
									placeholder="http://192.168.1.50:9100"
									className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
									autoFocus
									onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-muted-foreground mb-1.5">
									Name (optional)
								</label>
								<input
									type="text"
									value={connectName}
									onChange={(e) => setConnectName(e.target.value)}
									placeholder="My Remote Server"
									className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
									onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
								/>
							</div>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => {
										setShowConnectModal(false);
										setConnectUrl('');
										setConnectName('');
									}}
									className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleConnect}
									disabled={!connectUrl.trim()}
									className="px-3 py-1.5 text-xs bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50"
								>
									Connect
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
