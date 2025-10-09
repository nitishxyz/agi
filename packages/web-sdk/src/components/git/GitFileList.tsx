import { GitCommit, CheckSquare } from 'lucide-react';
import type { GitStatusResponse } from '../../types/api';
import { Button } from '../ui/Button';
import { GitFileItem } from './GitFileItem';
import { useGitStore } from '../../stores/gitStore';
import { useStageFiles } from '../../hooks/useGit';

interface GitFileListProps {
	status: GitStatusResponse;
}

export function GitFileList({ status }: GitFileListProps) {
	const { openCommitModal } = useGitStore();
	const stageFiles = useStageFiles();
	const hasStaged = status.staged.length > 0;
	const hasUnstaged = status.unstaged.length > 0 || status.untracked.length > 0;

	const unstagedFiles = [...status.unstaged, ...status.untracked];
	const hasUnstagedFiles = unstagedFiles.length > 0;

	// Check which staged files are also modified (appear in unstaged)
	const unstagedPaths = new Set(status.unstaged.map((f) => f.path));

	const handleStageAll = () => {
		const filesToStage = unstagedFiles.map((f) => f.path);
		if (filesToStage.length > 0) {
			stageFiles.mutate(filesToStage);
		}
	};

	return (
		<div className="flex flex-col">
			{/* Staged section */}
			{hasStaged && (
				<div className="border-b border-border">
					<div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
						<span className="text-xs font-semibold text-foreground uppercase">
							Staged Changes ({status.staged.length})
						</span>
						{status.staged.length > 0 && (
							<Button
								variant="primary"
								size="sm"
								onClick={openCommitModal}
								className="h-6 text-xs"
							>
								<GitCommit className="w-3 h-3 mr-1" />
								Commit
							</Button>
						)}
					</div>
					<div className="divide-y divide-border">
						{status.staged.map((file) => (
							<GitFileItem
								key={file.path}
								file={file}
								staged={true}
								showModifiedIndicator={unstagedPaths.has(file.path)}
							/>
						))}
					</div>
				</div>
			)}

			{/* Unstaged section */}
			{hasUnstaged && (
				<div>
					<div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
						<span className="text-xs font-semibold text-foreground uppercase">
							Changes ({status.unstaged.length + status.untracked.length})
						</span>
						{hasUnstagedFiles && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleStageAll}
								title="Stage all changes"
								className="h-6 text-xs"
							>
								<CheckSquare className="w-3 h-3 mr-1" />
								Stage All
							</Button>
						)}
					</div>
					<div className="divide-y divide-border">
						{status.unstaged.map((file) => (
							<GitFileItem key={file.path} file={file} staged={false} />
						))}
						{status.untracked.map((file) => (
							<GitFileItem key={file.path} file={file} staged={false} />
						))}
					</div>
				</div>
			)}

			{!hasStaged && !hasUnstaged && (
				<div className="p-4 text-sm text-muted-foreground text-center">
					No changes
				</div>
			)}
		</div>
	);
}
