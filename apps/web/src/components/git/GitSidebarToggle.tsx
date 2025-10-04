import { GitBranch } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useGitStatus } from '../../hooks/useGit';

export function GitSidebarToggle() {
	const { isExpanded, toggleSidebar } = useGitStore();
	const { data: status } = useGitStatus();

	if (isExpanded) return null;

	const totalChanges =
		(status?.staged?.length ?? 0) +
		(status?.unstaged?.length ?? 0) +
		(status?.untracked?.length ?? 0);

	return (
		<div className="w-12 border-l border-border bg-background flex flex-col items-center py-4">
			<button
				type="button"
				onClick={toggleSidebar}
				className="relative p-2 rounded hover:bg-muted transition-colors"
				title="Open Git sidebar"
			>
				<GitBranch className="w-5 h-5 text-muted-foreground" />
				{totalChanges > 0 && (
					<span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
						{totalChanges > 9 ? '9+' : totalChanges}
					</span>
				)}
			</button>
		</div>
	);
}
