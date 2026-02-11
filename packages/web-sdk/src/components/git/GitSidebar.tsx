import { memo, useEffect, useState } from 'react';
import { ChevronRight, GitBranch, RefreshCw, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGitStore } from '../../stores/gitStore';
import { usePanelWidthStore } from '../../stores/panelWidthStore';
import { useGitStatus, usePushCommits } from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { GitFileList } from './GitFileList';
import { ResizeHandle } from '../ui/ResizeHandle';

const PANEL_KEY = 'git';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

export const GitSidebar = memo(function GitSidebar() {
	const isExpanded = useGitStore((state) => state.isExpanded);
	const collapseSidebar = useGitStore((state) => state.collapseSidebar);
	const panelWidth = usePanelWidthStore(
		(s) => s.widths[PANEL_KEY] ?? DEFAULT_WIDTH,
	);
	const { data: status, isLoading, error, refetch } = useGitStatus();
	const queryClient = useQueryClient();
	const pushMutation = usePushCommits();
	const [pushError, setPushError] = useState<string | null>(null);

	// Auto-fetch when sidebar is opened or closed
	useEffect(() => {
		if (isExpanded) {
			// Fetch immediately when opening
			queryClient.invalidateQueries({ queryKey: ['git', 'status'] });
		}
	}, [isExpanded, queryClient]);

	// Manual refresh handler
	const handleRefresh = () => {
		refetch();
	};

	// Push handler
	const handlePush = async () => {
		setPushError(null);
		try {
			await pushMutation.mutateAsync();
		} catch (err) {
			setPushError(err instanceof Error ? err.message : 'Failed to push');
		}
	};

	if (!isExpanded) return null;

	const allFiles = [
		...(status?.conflicted || []),
		...(status?.staged || []),
		...(status?.unstaged || []),
		...(status?.untracked || []),
	];

	const totalChanges = allFiles.length;
	const canPush = status && status.ahead > 0;

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
				{/* Header */}
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

				{/* Content */}
				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="p-4 text-sm text-muted-foreground">
							Loading git status...
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

				{/* Push error message */}
				{pushError && (
		<div className="px-3 py-2 text-xs text-orange-500 border-t border-border bg-orange-50 dark:bg-orange-950/20">
						{pushError}
					</div>
				)}

				{/* Footer with branch info and buttons */}
	<div className="h-12 px-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<GitBranch className="w-3 h-3 flex-shrink-0" />
						{status?.branch && (
							<>
								<span className="truncate">{status.branch}</span>
								{status.ahead > 0 && (
									<span className="text-green-500 flex-shrink-0">
										↑{status.ahead}
									</span>
								)}
								{status.behind > 0 && (
									<span className="text-orange-500 flex-shrink-0">
										↓{status.behind}
									</span>
								)}
							</>
						)}
					</div>

					<div className="flex items-center gap-1 flex-shrink-0">
						{/* Push button - only show when we have commits to push */}
						{canPush && (
							<Button
								variant="ghost"
								size="icon"
								onClick={handlePush}
								title="Push commits to remote"
								className="h-6 w-6 transition-transform duration-200 hover:scale-110"
								disabled={pushMutation.isPending}
							>
								<Upload
									className={`w-3 h-3 ${pushMutation.isPending ? 'animate-pulse' : ''}`}
								/>
							</Button>
						)}

						{/* Refresh button */}
						<Button
							variant="ghost"
							size="icon"
							onClick={handleRefresh}
							title="Refresh git status"
							className="h-6 w-6 transition-transform duration-200 hover:scale-110"
							disabled={isLoading}
						>
							<RefreshCw
								className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}
							/>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
});
