import { useEffect, useRef, memo, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useGitDiff } from '../../hooks/useGit';
import { useGitDiffFullFile } from '../../hooks/useFileBrowser';
import { Button } from '../ui/Button';
import { GitDiffViewer } from './GitDiffViewer';

export const GitDiffPanel = memo(function GitDiffPanel() {
	// Use selectors to only subscribe to needed state
	const isDiffOpen = useGitStore((state) => state.isDiffOpen);
	const selectedFile = useGitStore((state) => state.selectedFile);
	const selectedFileStaged = useGitStore((state) => state.selectedFileStaged);
	const closeDiff = useGitStore((state) => state.closeDiff);

	const setCollapsed = useSidebarStore((state) => state.setCollapsed);
	const wasCollapsedRef = useRef<boolean | null>(null);
	const prevDiffOpenRef = useRef(false);

	const { data: diff, isLoading } = useGitDiff(
		selectedFile,
		selectedFileStaged,
	);

	const [showFullFile, setShowFullFile] = useState(false);
	const { data: fullFileDiff, isLoading: fullFileLoading } = useGitDiffFullFile(
		selectedFile,
		selectedFileStaged,
		showFullFile,
	);

	const activeDiff = showFullFile && fullFileDiff ? fullFileDiff : diff;
	const activeLoading = showFullFile ? fullFileLoading : isLoading;

	useEffect(() => {
		if (!isDiffOpen) setShowFullFile(false);
		if (isDiffOpen && !prevDiffOpenRef.current) {
			// Diff just opened - save current state and collapse
			const { isCollapsed } = useSidebarStore.getState();
			wasCollapsedRef.current = isCollapsed;
			setCollapsed(true);
		} else if (!isDiffOpen && prevDiffOpenRef.current) {
			// Diff just closed - restore previous state
			if (wasCollapsedRef.current !== null) {
				setCollapsed(wasCollapsedRef.current);
				wasCollapsedRef.current = null;
			}
		}
		prevDiffOpenRef.current = isDiffOpen;
	}, [isDiffOpen, setCollapsed]);

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
						title={`${selectedFile}\n${activeDiff?.absPath || ''}`}
					>
						{selectedFile}
					</span>
					{selectedFileStaged && (
						<span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
							Staged
						</span>
					)}
				</div>
				<Button
					variant={showFullFile ? 'secondary' : 'ghost'}
					size="sm"
					onClick={() => setShowFullFile((v) => !v)}
					title={showFullFile ? 'Show diff only' : 'Show full file with diff'}
					className="flex items-center gap-1.5 text-xs h-7"
				>
					{showFullFile ? (
						<Minimize2 className="w-3.5 h-3.5" />
					) : (
						<Maximize2 className="w-3.5 h-3.5" />
					)}
					{showFullFile ? 'Diff' : 'Full File'}
				</Button>
			</div>

			<div className="flex-1 overflow-auto">
				{activeLoading ? (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						Loading diff...
					</div>
				) : activeDiff ? (
					<GitDiffViewer diff={activeDiff} />
				) : (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						No diff available
					</div>
				)}
			</div>
		</div>
	);
});
