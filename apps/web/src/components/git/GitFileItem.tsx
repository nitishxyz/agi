import { FileIcon, FilePlus, FileX, Check, AlertCircle } from 'lucide-react';
import type { GitFileStatus } from '../../types/api';
import { useStageFiles, useUnstageFiles } from '../../hooks/useGit';
import { useGitStore } from '../../stores/gitStore';
import { useState } from 'react';

interface GitFileItemProps {
	file: GitFileStatus;
	staged: boolean;
	showModifiedIndicator?: boolean;
}

export function GitFileItem({
	file,
	staged,
	showModifiedIndicator = false,
}: GitFileItemProps) {
	const { openDiff } = useGitStore();
	const stageFiles = useStageFiles();
	const unstageFiles = useUnstageFiles();
	const [isChecked, setIsChecked] = useState(staged);

	const handleCheckChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		const checked = e.target.checked;
		setIsChecked(checked);

		try {
			if (checked) {
				await stageFiles.mutateAsync([file.path]);
			} else {
				await unstageFiles.mutateAsync([file.path]);
			}
		} catch (error) {
			// Revert on error
			setIsChecked(!checked);
			console.error('Failed to stage/unstage file:', error);
		}
	};

	const handleClick = () => {
		openDiff(file.path, staged);
	};

	// Status colors and icons
	const getStatusConfig = () => {
		switch (file.status) {
			case 'added':
			case 'untracked':
				return {
					icon: FilePlus,
					color: 'text-green-500',
					label: 'A',
					labelColor: 'text-green-500',
				};
			case 'deleted':
				return {
					icon: FileX,
					color: 'text-red-500',
					label: 'D',
					labelColor: 'text-red-500',
				};
			case 'modified':
				return {
					icon: FileIcon,
					color: 'text-blue-500',
					label: 'M',
					labelColor: 'text-blue-500',
				};
			case 'renamed':
				return {
					icon: FileIcon,
					color: 'text-purple-500',
					label: 'R',
					labelColor: 'text-purple-500',
				};
			default:
				return {
					icon: FileIcon,
					color: 'text-muted-foreground',
					label: '?',
					labelColor: 'text-muted-foreground',
				};
		}
	};

	const config = getStatusConfig();
	const Icon = config.icon;

	// Format file path to show "../dir/filename.tsx" format
	const formatFilePath = (path: string) => {
		const pathParts = path.split('/');
		const fileName = pathParts[pathParts.length - 1];

		if (pathParts.length === 1) {
			// Just a filename, no directory
			return fileName;
		}

		// Show last directory + filename
		const lastDir = pathParts[pathParts.length - 2];
		return `../${lastDir}/${fileName}`;
	};

	const displayPath = formatFilePath(file.path);

	return (
		<div
			className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer group transition-colors"
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleClick();
				}
			}}
			role="button"
			tabIndex={0}
		>
			<input
				type="checkbox"
				checked={isChecked}
				onChange={handleCheckChange}
				onClick={(e) => e.stopPropagation()}
				className="w-4 h-4 rounded border-border"
				aria-label={`${isChecked ? 'Unstage' : 'Stage'} ${file.path}`}
			/>

			<div className="flex items-center gap-2 flex-1 min-w-0">
				<Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span
							className="text-sm text-foreground truncate font-mono"
							title={file.path}
						>
							{displayPath}
						</span>
						<div className="flex items-center gap-1 flex-shrink-0">
							<span className={`text-xs font-semibold ${config.labelColor}`}>
								{config.label}
							</span>
							{showModifiedIndicator && (
								<div title="Also modified in working directory">
									<AlertCircle className="w-3.5 h-3.5 text-orange-500" />
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Stats */}
			{file.insertions !== undefined || file.deletions !== undefined ? (
				<div className="flex items-center gap-2 text-xs flex-shrink-0">
					{file.insertions !== undefined && file.insertions > 0 && (
						<span className="text-green-500">+{file.insertions}</span>
					)}
					{file.deletions !== undefined && file.deletions > 0 && (
						<span className="text-red-500">-{file.deletions}</span>
					)}
				</div>
			) : null}

			{/* Staged indicator */}
			{staged && !showModifiedIndicator && (
				<Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
			)}
		</div>
	);
}
