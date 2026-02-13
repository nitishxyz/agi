import { memo } from 'react';
import { GitBranch } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useGitStatus } from '../../hooks/useGit';

export const GitSidebarToggle = memo(function GitSidebarToggle() {
	// Use selectors to only subscribe to needed state
	const isExpanded = useGitStore((state) => state.isExpanded);
	const toggleSidebar = useGitStore((state) => state.toggleSidebar);
	const { data: status } = useGitStatus();

	const totalChanges =
		(status?.staged?.length ?? 0) +
		(status?.unstaged?.length ?? 0) +
		(status?.untracked?.length ?? 0);

	return (
		<button
			type="button"
			onClick={toggleSidebar}
			className={`relative h-14 w-full transition-colors touch-manipulation flex items-center justify-center border-r-2 ${
				isExpanded
					? 'bg-muted border-primary'
					: 'border-transparent hover:bg-muted/50'
			}`}
			title="Git"
		>
			<GitBranch className="w-5 h-5 text-muted-foreground mx-auto" />
			{totalChanges > 0 && (
				<span className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
					{totalChanges > 9 ? '9+' : totalChanges}
				</span>
			)}
		</button>
	);
});
