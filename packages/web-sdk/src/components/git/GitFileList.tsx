import { GitCommit, CheckSquare, Square } from 'lucide-react';
import type { GitStatusResponse } from '../../types/api';
import { Button } from '../ui/Button';
import { GitFileItem } from './GitFileItem';
import { useGitStore } from '../../stores/gitStore';
import { useStageFiles, useUnstageFiles } from '../../hooks/useGit';
import { useFocusStore } from '../../stores/focusStore';
import { useEffect, useRef, useMemo } from 'react';

interface GitFileListProps {
	status: GitStatusResponse;
}

export function GitFileList({ status }: GitFileListProps) {
	const { openCommitModal, openDiff } = useGitStore();
	const stageFiles = useStageFiles();
	const unstageFiles = useUnstageFiles();
	const { currentFocus, gitFileIndex } = useFocusStore();
	const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	const hasStaged = status.staged.length > 0;
	const hasUnstaged = status.unstaged.length > 0 || status.untracked.length > 0;

	const unstagedFiles = [...status.unstaged, ...status.untracked];
	const hasUnstagedFiles = unstagedFiles.length > 0;

	const allFiles = useMemo(() => {
		return [...status.staged, ...status.unstaged, ...status.untracked];
	}, [status]);

	const unstagedPaths = new Set(status.unstaged.map((f) => f.path));

	const handleStageAll = () => {
		const filesToStage = unstagedFiles.map((f) => f.path);
		if (filesToStage.length > 0) {
			stageFiles.mutate(filesToStage);
		}
	};

	const handleUnstageAll = () => {
		const filesToUnstage = status.staged.map((f) => f.path);
		if (filesToUnstage.length > 0) {
			unstageFiles.mutate(filesToUnstage);
		}
	};

	useEffect(() => {
		if (currentFocus === 'git' && gitFileIndex >= 0) {
			const element = itemRefs.current.get(gitFileIndex);
			element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

			// Auto-show diff for focused file
			const allFiles = [
				...status.staged,
				...status.unstaged,
				...status.untracked,
			];
			const focusedFile = allFiles[gitFileIndex];
			if (focusedFile) {
				// Determine if file is staged or unstaged
				const isStaged = status.staged.includes(focusedFile);
				openDiff(focusedFile.path, isStaged);
			}
		}
	}, [
		currentFocus,
		gitFileIndex,
		status.staged,
		status.unstaged,
		status.untracked,
	]);

	return (
		<div className="flex flex-col">
			{hasStaged && (
				<div className="border-b border-border">
					<div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
						<span className="text-xs font-semibold text-foreground uppercase">
							Staged Changes ({status.staged.length})
						</span>
						<div className="flex items-center gap-1">
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
					</div>
					<div className="divide-y divide-border">
						{status.staged.map((file, index) => {
							const globalIndex = index;
							const isFocused =
								currentFocus === 'git' && gitFileIndex === globalIndex;
							return (
								<div
									key={file.path}
									ref={(el) => {
										if (el) itemRefs.current.set(globalIndex, el);
										else itemRefs.current.delete(globalIndex);
									}}
									className={
										isFocused ? 'ring-1 ring-inset ring-primary/40' : ''
									}
								>
									<GitFileItem
										file={file}
										staged={true}
										showModifiedIndicator={unstagedPaths.has(file.path)}
									/>
								</div>
							);
						})}
					</div>
				</div>
			)}

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
						{status.unstaged.map((file, index) => {
							const globalIndex = status.staged.length + index;
							const isFocused =
								currentFocus === 'git' && gitFileIndex === globalIndex;
							return (
								<div
									key={file.path}
									ref={(el) => {
										if (el) itemRefs.current.set(globalIndex, el);
										else itemRefs.current.delete(globalIndex);
									}}
									className={
										isFocused ? 'ring-1 ring-inset ring-primary/40' : ''
									}
								>
									<GitFileItem file={file} staged={false} />
								</div>
							);
						})}
						{status.untracked.map((file, index) => {
							const globalIndex =
								status.staged.length + status.unstaged.length + index;
							const isFocused =
								currentFocus === 'git' && gitFileIndex === globalIndex;
							return (
								<div
									key={file.path}
									ref={(el) => {
										if (el) itemRefs.current.set(globalIndex, el);
										else itemRefs.current.delete(globalIndex);
									}}
									className={
										isFocused ? 'ring-1 ring-inset ring-primary/40' : ''
									}
								>
									<GitFileItem file={file} staged={false} />
								</div>
							);
						})}
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
