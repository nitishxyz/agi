import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useGitDiff } from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { GitDiffViewer } from './GitDiffViewer';

export function GitDiffPanel() {
	const { isDiffOpen, selectedFile, selectedFileStaged, closeDiff } =
		useGitStore();
	const { wasCollapsedBeforeDiff, setWasCollapsedBeforeDiff, setCollapsed } =
		useSidebarStore();
	const { data: diff, isLoading } = useGitDiff(
		selectedFile,
		selectedFileStaged,
	);

	// Auto-collapse left sidebar when diff opens, and restore when it closes
	useEffect(() => {
		const { isCollapsed } = useSidebarStore.getState();

		if (isDiffOpen) {
			// Save current state and collapse
			setWasCollapsedBeforeDiff(isCollapsed);
			setCollapsed(true);
		} else if (wasCollapsedBeforeDiff !== null) {
			// Restore previous state when diff closes
			setCollapsed(wasCollapsedBeforeDiff);
			setWasCollapsedBeforeDiff(null);
		}
	}, [isDiffOpen, setWasCollapsedBeforeDiff, setCollapsed, wasCollapsedBeforeDiff]);

	// Handle ESC key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isDiffOpen) {
				closeDiff();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isDiffOpen, closeDiff]);

	if (!isDiffOpen || !selectedFile) return null;

	// Format file path to show "../dir/dir/filename.tsx" format
	const formatFilePath = (path: string) => {
		const pathParts = path.split('/');
		
		if (pathParts.length === 1) {
			// Just a filename
			return path;
		}
		
		if (pathParts.length <= 3) {
			// Short path, show it all
			return path;
		}
		
		// Show last 2 directories + filename
		const fileName = pathParts[pathParts.length - 1];
		const dirs = pathParts.slice(-3, -1).join('/');
		return `.../${dirs}/${fileName}`;
	};

	const displayPath = formatFilePath(selectedFile);

	return (
		<div className="absolute inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-left duration-300">
			{/* Header */}
			<div className="h-14 border-b border-border px-4 flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={closeDiff}
					title="Close diff viewer (ESC)"
				>
					<X className="w-4 h-4" />
				</Button>
				<div className="flex-1 flex items-center gap-2">
					<span 
						className="text-sm font-medium text-foreground truncate font-mono"
						title={selectedFile}
					>
						{displayPath}
					</span>
					{selectedFileStaged && (
						<span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
							Staged
						</span>
					)}
				</div>
			</div>

			{/* Diff content */}
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						Loading diff...
					</div>
				) : diff ? (
					<GitDiffViewer diff={diff} />
				) : (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						No diff available
					</div>
				)}
			</div>
		</div>
	);
}
