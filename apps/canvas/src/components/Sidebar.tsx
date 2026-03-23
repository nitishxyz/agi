import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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

export function Sidebar() {
	const workspaces = useWorkspaceStore((state) => state.workspaces);
	const environments = useWorkspaceStore((state) => state.environments);
	const activeId = useWorkspaceStore((state) => state.activeId);
	const setActive = useWorkspaceStore((state) => state.setActive);
	const addWorkspace = useWorkspaceStore((state) => state.addWorkspace);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [draftPath, setDraftPath] = useState('');
	const [draftName, setDraftName] = useState('');
	const [error, setError] = useState<string | null>(null);

	const suggestedName = useMemo(() => {
		if (!draftPath.trim()) return '';
		return getWorkspaceNameFromPath(draftPath);
	}, [draftPath]);

	const resetCreateState = useCallback(() => {
		setIsCreateOpen(false);
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
			resetCreateState();
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : String(nextError));
		}
	}, [addWorkspace, draftName, draftPath, resetCreateState]);

	return (
		<>
			<div className="flex h-full w-[68px] flex-shrink-0 flex-col items-center">
				<div className="h-[48px] w-full flex-shrink-0" data-tauri-drag-region />

				<div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
					{workspaces.map((workspace) => {
						const isActive = workspace.id === activeId;
						const environment = environments[workspace.primaryEnvironmentId];
						return (
							<div key={workspace.id} className="relative flex w-full items-center justify-center">
								<div
									className={`absolute left-0 w-[4px] rounded-r-full transition-all duration-200 ${
										isActive
											? 'h-[20px] bg-white'
											: 'h-0 group-hover:h-[8px] bg-white/40'
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
										className={`flex h-[44px] w-[44px] items-center justify-center text-[14px] font-bold transition-all duration-200 ${
											isActive
												? 'rounded-[14px]'
												: 'rounded-[22px] group-hover:rounded-[14px]'
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
						onClick={() => setIsCreateOpen(true)}
						className="group"
						title="Add a workspace"
					>
						<div className="flex h-[44px] w-[44px] items-center justify-center rounded-[22px] bg-white/[0.06] text-canvas-text-muted transition-all duration-200 group-hover:rounded-[14px] group-hover:bg-green-400/10 group-hover:text-green-400">
							<Plus size={20} strokeWidth={1.5} />
						</div>
					</button>
				</div>

				<div className="h-3 flex-shrink-0" />
			</div>

			{isCreateOpen && (
				<div
					data-native-overlay-root="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
				>
					<div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[rgba(18,18,22,0.96)] p-4 shadow-2xl backdrop-blur-xl">
						<div className="mb-4 flex items-start justify-between gap-4">
							<div className="space-y-1">
								<h2 className="text-[13px] font-semibold text-canvas-text">
									Create workspace
								</h2>
								<p className="text-[11px] leading-5 text-canvas-text-muted">
									Link this workspace to a local project path. Canvas will persist the layout for this workspace.
								</p>
							</div>
							<button
								onClick={resetCreateState}
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

							{error && (
								<p className="text-[11px] text-red-400">{error}</p>
							)}

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									type="button"
									onClick={resetCreateState}
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
