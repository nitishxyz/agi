import { memo, useEffect } from 'react';
import { ChevronRight, GitBranch, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGitStore } from '../../stores/gitStore';
import { useGitStatus } from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { GitFileList } from './GitFileList';

export const GitSidebar = memo(function GitSidebar() {
	// Use selectors to only subscribe to needed state
	const isExpanded = useGitStore((state) => state.isExpanded);
	const collapseSidebar = useGitStore((state) => state.collapseSidebar);
	const { data: status, isLoading, refetch } = useGitStatus();
	const queryClient = useQueryClient();

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

	if (!isExpanded) return null;

	const allFiles = [
		...(status?.staged || []),
		...(status?.unstaged || []),
		...(status?.untracked || []),
	];

	const totalChanges = allFiles.length;

	return (
		<div className="w-80 border-l border-border bg-background flex flex-col h-full">
			{/* Header */}
			<div className="h-14 border-b border-border px-4 flex items-center justify-between">
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
				) : !status || totalChanges === 0 ? (
					<div className="p-4 text-sm text-muted-foreground">
						No changes detected
					</div>
				) : (
					<GitFileList status={status} />
				)}
			</div>

			{/* Branch info footer with refresh button */}
			{status?.branch && (
				<div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
					<div className="flex items-center gap-2">
						<GitBranch className="w-3 h-3" />
						<span>{status.branch}</span>
						{status.ahead > 0 && (
							<span className="text-green-500">↑{status.ahead}</span>
						)}
						{status.behind > 0 && (
							<span className="text-orange-500">↓{status.behind}</span>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleRefresh}
						title="Refresh git status"
						className="h-6 w-6 transition-transform duration-200 hover:scale-110"
						disabled={isLoading}
					>
						<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
					</Button>
				</div>
			)}
		</div>
	);
});
