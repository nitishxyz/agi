import { useEffect, memo } from 'react';
import { X } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useGitDiff } from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { GitDiffViewer } from './GitDiffViewer';

export const GitDiffPanel = memo(function GitDiffPanel() {
	// Use selectors to only subscribe to needed state
	const isDiffOpen = useGitStore((state) => state.isDiffOpen);
	const selectedFile = useGitStore((state) => state.selectedFile);
	const selectedFileStaged = useGitStore((state) => state.selectedFileStaged);
	const closeDiff = useGitStore((state) => state.closeDiff);

	const wasCollapsedBeforeDiff = useSidebarStore(
		(state) => state.wasCollapsedBeforeDiff,
	);
	const setWasCollapsedBeforeDiff = useSidebarStore(
		(state) => state.setWasCollapsedBeforeDiff,
	);
	const setCollapsed = useSidebarStore((state) => state.setCollapsed);

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
	}, [
		isDiffOpen,
		setWasCollapsedBeforeDiff,
		setCollapsed,
		wasCollapsedBeforeDiff,
	]);

	// Handle ESC key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;
			if ((e.key === 'Escape' || (e.key === 'q' && !isInInput)) && isDiffOpen) {
				closeDiff();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isDiffOpen, closeDiff]);

	if (!isDiffOpen || !selectedFile) return null;

	return (
		<div className="absolute inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-left duration-300">
			{/* Header - Full path display */}
			<div className="h-14 border-b border-border px-4 flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={closeDiff}
					title="Close diff viewer (ESC)"
				>
					<X className="w-4 h-4" />
				</Button>
				<div className="flex-1 flex items-center gap-2 min-w-0">
					<span
						className="text-sm font-medium text-foreground font-mono truncate"
						title={`${selectedFile}\n${diff?.absPath || ''}`}
					>
						{selectedFile}
					</span>
					{selectedFileStaged && (
						<span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
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
});
