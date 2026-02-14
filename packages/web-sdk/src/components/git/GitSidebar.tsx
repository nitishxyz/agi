import { memo, useCallback, useEffect, useState } from 'react';
import {
	FolderGit2,
	ChevronRight,
	Download,
	GitBranch,
	RefreshCw,
	Sparkles,
	Upload,
	X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGitStore } from '../../stores/gitStore';
import { usePanelWidthStore } from '../../stores/panelWidthStore';
import {
	useGitStatus,
	usePullChanges,
	usePushCommits,
	useGitInit,
} from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { GitFileList } from './GitFileList';
import { ResizeHandle } from '../ui/ResizeHandle';

const PANEL_KEY = 'git';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

interface GitError {
	id: string;
	message: string;
	context?: string;
}

interface GitSidebarProps {
	onFixWithAI?: (errorMessage: string) => void;
}

export const GitSidebar = memo(function GitSidebar({
	onFixWithAI,
}: GitSidebarProps) {
	const isExpanded = useGitStore((state) => state.isExpanded);
	const collapseSidebar = useGitStore((state) => state.collapseSidebar);
	const panelWidth = usePanelWidthStore(
		(s) => s.widths[PANEL_KEY] ?? DEFAULT_WIDTH,
	);
	const { data: status, isLoading, error, refetch } = useGitStatus();
	const queryClient = useQueryClient();
	const pushMutation = usePushCommits();
	const pullMutation = usePullChanges();
	const initMutation = useGitInit();
	const [errors, setErrors] = useState<GitError[]>([]);

	useEffect(() => {
		if (isExpanded) {
			queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
		}
	}, [isExpanded, queryClient]);

	const handleRefresh = () => {
		refetch();
	};

	const addError = useCallback((message: string, context?: string) => {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		setErrors((prev) => [...prev, { id, message, context }]);
	}, []);

	const dismissError = useCallback((id: string) => {
		setErrors((prev) => prev.filter((e) => e.id !== id));
	}, []);

	const handlePush = async () => {
		try {
			await pushMutation.mutateAsync();
		} catch (err) {
			addError(
				err instanceof Error ? err.message : 'Failed to push',
				'git push',
			);
		}
	};

	const handlePull = async () => {
		try {
			await pullMutation.mutateAsync();
		} catch (err) {
			addError(
				err instanceof Error ? err.message : 'Failed to pull',
				'git pull',
			);
		}
	};

	const handleFixWithAI = useCallback(
		(gitError: GitError) => {
			const prompt = gitError.context
				? `I got a git error during ${gitError.context}:\n\n${gitError.message}\n\nPlease help me fix this.`
				: `I got a git error:\n\n${gitError.message}\n\nPlease help me fix this.`;
			dismissError(gitError.id);
			onFixWithAI?.(prompt);
		},
		[onFixWithAI, dismissError],
	);

	if (!isExpanded) return null;

	const allFiles = [
		...(status?.conflicted || []),
		...(status?.staged || []),
		...(status?.unstaged || []),
		...(status?.untracked || []),
	];

	const totalChanges = allFiles.length;
	const canPush = status && status.ahead > 0;
	const _canPull = !!status;
	const hasPendingPulls = status && status.behind > 0;
	const isActing = pushMutation.isPending || pullMutation.isPending;
	const isNotGitRepo =
		error instanceof Error &&
		error.message.toLowerCase().includes('not a git repository');

	return (
		<div
			className="border-l border-border bg-background flex h-full relative"
			style={{ width: panelWidth }}
		>
			<ResizeHandle
				panelKey={PANEL_KEY}
				side="right"
				minWidth={MIN_WIDTH}
				maxWidth={MAX_WIDTH}
				defaultWidth={DEFAULT_WIDTH}
			/>
			<div className="flex-1 flex flex-col h-full min-w-0 w-full">
				<div className="h-14 border-b border-border px-3 flex items-center justify-between">
					<div className="flex items-center gap-2 flex-1">
						<GitBranch className="w-4 h-4 text-muted-foreground" />
						<span className="font-medium text-foreground">
							Git Changes
							{totalChanges > 0 && (
								<span className="ml-2 text-xs text-muted-foreground">
									({totalChanges})
								</span>
							)}
						</span>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={collapseSidebar}
						title="Close sidebar"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="p-4 text-sm text-muted-foreground">
							Loading git status...
						</div>
					) : isNotGitRepo ? (
						<div className="p-4 flex flex-col items-center justify-center gap-3 text-center">
							<FolderGit2 className="w-10 h-10 text-muted-foreground" />
							<div className="text-sm text-muted-foreground">
								No git repository found in this directory.
							</div>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => initMutation.mutate()}
								disabled={initMutation.isPending}
								className="gap-1.5"
							>
								<GitBranch
									className={`w-3.5 h-3.5 ${initMutation.isPending ? 'animate-spin' : ''}`}
								/>
								{initMutation.isPending
									? 'Initializing...'
									: 'Initialize Repository'}
							</Button>
							{initMutation.isError && (
								<span className="text-xs text-orange-500">
									{initMutation.error instanceof Error
										? initMutation.error.message
										: 'Failed to initialize'}
								</span>
							)}
						</div>
					) : error ? (
						<div className="p-3 text-sm text-muted-foreground">
							<div className="flex flex-col gap-2">
								<span className="text-orange-500">
									{error instanceof Error
										? error.message
										: 'Failed to load git status'}
								</span>
								<Button variant="secondary" size="sm" onClick={handleRefresh}>
									Retry
								</Button>
							</div>
						</div>
					) : !status || totalChanges === 0 ? (
						<div className="p-3 text-sm text-muted-foreground">
							No changes detected
						</div>
					) : (
						<GitFileList status={status} />
					)}
				</div>

				{errors.length > 0 && (
					<div className="border-t border-border">
						{errors.map((gitError) => (
							<div
								key={gitError.id}
								className="px-3 py-2 text-xs border-b border-border last:border-b-0 bg-orange-50 dark:bg-orange-950/20 flex items-start gap-2"
							>
								<span className="text-orange-500 flex-1 min-w-0 break-words">
									{gitError.message}
								</span>
								<div className="flex items-center gap-1 flex-shrink-0">
									{onFixWithAI && (
										<button
											type="button"
											onClick={() => handleFixWithAI(gitError)}
											className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
											title="Fix with AI"
										>
											<Sparkles className="w-3 h-3" />
											Fix
										</button>
									)}
									<button
										type="button"
										onClick={() => dismissError(gitError.id)}
										className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
										title="Dismiss"
									>
										<X className="w-3 h-3" />
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				<div className="h-12 border-t border-border flex items-center gap-1 px-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={handlePull}
						disabled={isActing}
						title={
							hasPendingPulls
								? `Pull ${status?.behind} commit(s) from remote`
								: 'Pull from remote'
						}
						className="flex-1 h-8 text-xs gap-1.5"
					>
						<Download
							className={`w-3.5 h-3.5 ${pullMutation.isPending ? 'animate-pulse' : ''}`}
						/>
						Pull
						{hasPendingPulls && (
							<span className="text-orange-500">↓{status?.behind}</span>
						)}
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={handlePush}
						disabled={!canPush || isActing}
						title={
							canPush
								? `Push ${status?.ahead} commit(s) to remote`
								: 'Nothing to push'
						}
						className="flex-1 h-8 text-xs gap-1.5"
					>
						<Upload
							className={`w-3.5 h-3.5 ${pushMutation.isPending ? 'animate-pulse' : ''}`}
						/>
						Push
						{canPush && (
							<span className="text-green-500">↑{status?.ahead}</span>
						)}
					</Button>
				</div>

				<div className="h-12 px-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<GitBranch className="w-3 h-3 flex-shrink-0" />
						{status?.branch && (
							<span className="truncate">{status.branch}</span>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleRefresh}
						title="Refresh git status"
						className="h-6 w-6 flex-shrink-0"
						disabled={isLoading}
					>
						<RefreshCw
							className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}
						/>
					</Button>
				</div>
			</div>
		</div>
	);
});
