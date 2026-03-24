import { open } from '@tauri-apps/plugin-dialog';
import { Bot, FolderOpen, Globe, Plus, Terminal, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { WorkspaceTabState } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function getInitials(name: string): string {
	const parts = name.split(/[-_\s]+/);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return name.slice(0, 2).toUpperCase();
}

function getWorkspaceNameFromPath(path: string) {
	const normalized = path.replace(/[\\/]+$/, '');
	const parts = normalized.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] || 'workspace';
}

function getTabGlyph(tab: WorkspaceTabState) {
	if (tab.kind === 'canvas') return '▣';
	if (tab.kind === 'pending') return <Plus size={12} strokeWidth={1.75} />;
	if (tab.block.type === 'browser') return <Globe size={12} strokeWidth={1.75} />;
	if (tab.block.type === 'otto') return <Bot size={12} strokeWidth={1.75} />;
	return <Terminal size={12} strokeWidth={1.75} />;
}

function getTabDescription(tab: WorkspaceTabState) {
	if (tab.kind === 'canvas') return 'Split layouts and mixed blocks';
	if (tab.kind === 'pending') return 'Choose what to open next';
	if (tab.block.type === 'browser') return 'Focused browser surface';
	if (tab.block.type === 'otto') return 'Focused agent surface';
	return 'Focused terminal surface';
}

type SidebarGroupId = 'drafts' | 'agents' | 'browsers' | 'terminal' | 'commands' | 'canvas';

interface SidebarGroupDefinition {
	id: SidebarGroupId;
	label: string;
	matches: (tab: WorkspaceTabState) => boolean;
}

const SIDEBAR_GROUPS: SidebarGroupDefinition[] = [
	{
		id: 'drafts',
		label: 'Drafts',
		matches: (tab) => tab.kind === 'pending',
	},
	{
		id: 'agents',
		label: 'Agents',
		matches: (tab) => tab.kind === 'block' && tab.block.type === 'otto',
	},
	{
		id: 'browsers',
		label: 'Browsers',
		matches: (tab) => tab.kind === 'block' && tab.block.type === 'browser',
	},
	{
		id: 'terminal',
		label: 'Terminal',
		matches: (tab) => tab.kind === 'block' && tab.block.type === 'terminal',
	},
	{
		id: 'commands',
		label: 'Commands',
		matches: () => false,
	},
	{
		id: 'canvas',
		label: 'Canvas',
		matches: (tab) => tab.kind === 'canvas',
	},
];

export function Sidebar() {
	const workspaces = useWorkspaceStore((state) => state.workspaces);
	const environments = useWorkspaceStore((state) => state.environments);
	const activeId = useWorkspaceStore((state) => state.activeId);
	const setActive = useWorkspaceStore((state) => state.setActive);
	const addWorkspace = useWorkspaceStore((state) => state.addWorkspace);
	const tabs = useCanvasStore((state) => state.tabs);
	const tabOrder = useCanvasStore((state) => state.tabOrder);
	const activeTabId = useCanvasStore((state) => state.activeTabId);
	const setActiveTab = useCanvasStore((state) => state.setActiveTab);
	const openCreateTab = useCanvasStore((state) => state.openCreateTab);
	const removeTab = useCanvasStore((state) => state.removeTab);
	const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
	const [draftPath, setDraftPath] = useState('');
	const [draftName, setDraftName] = useState('');
	const [error, setError] = useState<string | null>(null);

	const suggestedName = useMemo(() => {
		if (!draftPath.trim()) return '';
		return getWorkspaceNameFromPath(draftPath);
	}, [draftPath]);

	const orderedTabs = useMemo(
		() =>
			tabOrder
				.map((tabId) => tabs[tabId])
				.filter((tab): tab is WorkspaceTabState => Boolean(tab)),
		[tabOrder, tabs],
	);

	const groupedTabs = useMemo(
		() =>
			SIDEBAR_GROUPS.map((group) => ({
				...group,
				tabs: orderedTabs.filter((tab) => group.matches(tab)),
			})).filter((group) => group.tabs.length > 0),
		[orderedTabs],
	);

	const resetCreateWorkspaceState = useCallback(() => {
		setIsCreateWorkspaceOpen(false);
		setDraftPath('');
		setDraftName('');
		setError(null);
	}, []);

	const handlePickProjectPath = useCallback(async () => {
		try {
			const selected = await open({
				directory: true,
				multiple: false,
				defaultPath: draftPath.trim() || undefined,
				title: 'Choose project folder',
			});
			if (!selected || Array.isArray(selected)) return;
			setDraftPath(selected);
			setError(null);
			if (!draftName.trim()) {
				setDraftName(getWorkspaceNameFromPath(selected));
			}
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : String(nextError));
		}
	}, [draftName, draftPath]);

	const handleAddWorkspace = useCallback(() => {
		const path = draftPath.trim();
		if (!path) {
			setError('Choose a project folder first.');
			return;
		}
		const name = draftName.trim() || getWorkspaceNameFromPath(path);
		try {
			addWorkspace({ name, path });
			resetCreateWorkspaceState();
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : String(nextError));
		}
	}, [addWorkspace, draftName, draftPath, resetCreateWorkspaceState]);

	return (
		<>
			<div className="flex h-full w-[288px] flex-shrink-0 flex-col overflow-hidden pt-1">
				<div className="flex h-[36px] flex-shrink-0">
					<div className="w-[68px] flex-shrink-0" data-tauri-drag-region />
					<div className="flex min-w-0 flex-1" data-tauri-drag-region />
				</div>

				<div className="flex min-h-0 flex-1 overflow-hidden">
					<div className="flex h-full w-[68px] flex-shrink-0 flex-col items-center">
						<div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
							{workspaces.map((workspace) => {
								const isActive = workspace.id === activeId;
								const environment = environments[workspace.primaryEnvironmentId];
								return (
									<div key={workspace.id} className="group relative flex w-full items-center justify-center">
										<div
											className={`absolute left-0 w-[4px] rounded-r-full transition-all duration-200 ${
												isActive ? 'h-[20px] bg-white' : 'h-0 bg-white/40 group-hover:h-[8px]'
											}`}
										/>
										<button
											onClick={() => setActive(workspace.id)}
											className="group relative"
											title={
												environment
													? `${workspace.name}\n${environment.path}`
													: workspace.name
											}
										>
											<div
												className={`flex h-[44px] w-[44px] items-center justify-center rounded-[10px] text-[14px] font-bold transition-all duration-200 ${
													isActive ? '' : 'group-hover:rounded-[10px]'
												}`}
												style={{ backgroundColor: workspace.color }}
											>
												<span className="select-none text-white">
													{getInitials(workspace.name)}
												</span>
											</div>
										</button>
									</div>
								);
							})}

							<div className="mx-auto my-1 h-[1px] w-[36px] flex-shrink-0 bg-white/[0.08]" />

							<button
								onClick={() => setIsCreateWorkspaceOpen(true)}
								className="group"
								title="Add a workspace"
							>
								<div className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] bg-white/[0.10] text-white/60 transition-all duration-200 group-hover:bg-green-400/15 group-hover:text-green-400">
									<Plus size={20} strokeWidth={1.5} />
								</div>
							</button>
						</div>
					</div>

					<div className="flex min-w-0 flex-1 flex-col">
						{activeId ? (
							<>
								<div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
									<div className="space-y-3">
										{groupedTabs.map((group) => (
											<section key={group.id} className="space-y-1.5">
												<div className="flex items-center justify-between px-1">
													<p className="text-[10px] uppercase tracking-[0.14em] text-white/32">
														{group.label}
													</p>
													<span className="text-[9px] text-white/24">{group.tabs.length}</span>
												</div>

												<div className="space-y-1">
													{group.tabs.map((tab) => {
															const isActive = tab.id === activeTabId;
															return (
																<button
																	key={tab.id}
																	onClick={() => setActiveTab(tab.id)}
																	className={`group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
																		isActive
																			? 'border-white/[0.12] bg-white/[0.10]'
																			: 'border-transparent bg-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.07]'
																	}`}
																>
																	<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.08] text-white/65">
																		{getTabGlyph(tab)}
																	</div>
																	<div className="min-w-0 flex-1">
																		<p className="truncate text-[11px] font-medium text-white/82">
																			{tab.title}
																		</p>
																		<p className="truncate text-[10px] text-white/45">
																			{getTabDescription(tab)}
																		</p>
																	</div>
																	<div
																		role="button"
																		tabIndex={0}
																		onClick={(event) => {
																			event.stopPropagation();
																			removeTab(tab.id);
																		}}
																		onKeyDown={(event) => {
																			if (event.key === 'Enter') {
																				event.stopPropagation();
																				removeTab(tab.id);
																			}
																		}}
																		className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-white/45 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
																		title="Close tab"
																	>
																		<X size={12} strokeWidth={1.75} />
																	</div>
																</button>
															);
													})}
												</div>
											</section>
										))}
									</div>
								</div>

								<div className="border-t border-white/[0.06] p-2">
									<button
										onClick={openCreateTab}
										className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/[0.09] hover:text-white"
										title="Create tab"
									>
										<Plus size={14} strokeWidth={1.75} />
										New tab
									</button>
								</div>
							</>
						) : (
							<div className="flex h-full items-center justify-center px-4 text-center">
								<p className="max-w-[180px] text-[11px] leading-5 text-canvas-text-muted">
									Create a workspace to open canvases, browsers, terminals, and Otto tabs.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{isCreateWorkspaceOpen && (
				<div
					data-native-overlay-root="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
				>
					<div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[rgba(18,18,22,0.96)] p-4 shadow-2xl backdrop-blur-xl">
						<div className="mb-4 flex items-start justify-between gap-4">
							<div className="space-y-1">
								<h2 className="text-[13px] font-semibold text-canvas-text">Create workspace</h2>
								<p className="text-[11px] leading-5 text-canvas-text-muted">
									Link this workspace to a local project path. Canvas will persist tabs and layouts for this workspace.
								</p>
							</div>
							<button
								onClick={resetCreateWorkspaceState}
								className="rounded-md p-1 text-canvas-text-muted transition-colors hover:bg-white/[0.06] hover:text-canvas-text"
							>
								<X size={14} />
							</button>
						</div>

						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								handleAddWorkspace();
							}}
						>
							<div className="space-y-1.5">
								<label className="text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
									Project folder
								</label>
								<button
									type="button"
									onClick={() => void handlePickProjectPath()}
									className="flex h-10 w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-left text-[12px] text-canvas-text outline-none transition-colors hover:bg-white/[0.06] focus:border-canvas-border-active"
								>
									<span className={draftPath ? 'truncate text-canvas-text' : 'truncate text-canvas-text-muted'}>
										{draftPath || 'Choose project folder…'}
									</span>
									<FolderOpen size={14} className="ml-3 shrink-0 text-canvas-text-muted" />
								</button>
							</div>

							<div className="space-y-1.5">
								<label className="text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
									Workspace name
								</label>
								<input
									value={draftName}
									onChange={(event) => setDraftName(event.target.value)}
									placeholder={suggestedName || 'project-name'}
									className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-canvas-text outline-none transition-colors placeholder:text-canvas-text-muted focus:border-canvas-border-active"
								/>
							</div>

							{error && <p className="text-[11px] text-red-400">{error}</p>}

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									type="button"
									onClick={resetCreateWorkspaceState}
									className="rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-canvas-text-muted transition-colors hover:bg-white/[0.06] hover:text-canvas-text"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="rounded-lg bg-canvas-accent px-3 py-2 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500"
								>
									Create workspace
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
