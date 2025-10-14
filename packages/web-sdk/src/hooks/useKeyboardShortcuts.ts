import { useEffect, useCallback } from 'react';
import { useFocusStore } from '../stores/focusStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { useGitStore } from '../stores/gitStore';

interface UseKeyboardShortcutsOptions {
	sessionIds: string[];
	activeSessionId?: string;
	gitFiles: Array<{ path: string; staged: boolean; status?: string }>;
	onSelectSession: (sessionId: string) => void;
	onNewSession: () => void;
	onStageFile?: (path: string) => void;
	onUnstageFile?: (path: string) => void;
	onRestoreFile?: (path: string) => void;
	onDeleteFile?: (path: string) => void;
	onStageAll?: () => void;
	onUnstageAll?: () => void;
	onOpenCommitModal?: () => void;
	onViewDiff?: (file: string, staged: boolean) => void;
	onReturnToInput?: () => void;
}

export function useKeyboardShortcuts({
	sessionIds,
	activeSessionId,
	gitFiles,
	onSelectSession,
	onNewSession,
	onStageFile,
	onUnstageFile,
	onRestoreFile,
	onDeleteFile,
	onStageAll,
	onUnstageAll,
	onOpenCommitModal,
	onViewDiff,
	onReturnToInput,
}: UseKeyboardShortcutsOptions) {
	const {
		currentFocus,
		sessionIndex,
		gitFileIndex,
		setFocus,
		setSessionIndex,
		setGitFileIndex,
		resetGitFileIndex,
	} = useFocusStore();
	const {
		setCollapsed: setSessionListCollapsed,
		toggleCollapse: toggleSessionList,
	} = useSidebarStore();
	const { isExpanded: isGitExpanded, toggleSidebar: toggleGit } = useGitStore();
	const closeDiff = useGitStore((state) => state.closeDiff);

	const currentSessionIndex = sessionIds.indexOf(activeSessionId || '');

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;

			if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
				e.preventDefault();

				// Ctrl+H: center -> left, left -> center, right -> center
				if (currentFocus === 'sessions') {
					// Already on sessions, go back to center
					(document.activeElement as HTMLElement)?.blur();
					setFocus('input');
					setSessionListCollapsed(true);
					// Focus the input after a small delay to ensure sidebar is collapsing
					setTimeout(() => onReturnToInput?.(), 50);
				} else if (currentFocus === 'git') {
					// On right sidebar, go back to center (don't jump to left)
					(document.activeElement as HTMLElement)?.blur();
					setFocus('input');
					toggleGit();
					closeDiff();
					setTimeout(() => onReturnToInput?.(), 50);
				} else {
					// From center, go to left sidebar
					(document.activeElement as HTMLElement)?.blur();
					setFocus('sessions');
					setSessionListCollapsed(false);
					if (currentSessionIndex >= 0) {
						setSessionIndex(currentSessionIndex);
					}
				}
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
				e.preventDefault();

				// Ctrl+L: center -> right, right -> center, left -> center
				if (currentFocus === 'git') {
					// Already on git, go back to center
					(document.activeElement as HTMLElement)?.blur();
					setFocus('input');
					toggleGit();
					closeDiff();
					// Focus the input after a small delay to ensure sidebar is collapsing
					setTimeout(() => onReturnToInput?.(), 50);
				} else if (currentFocus === 'sessions') {
					// On left sidebar, go back to center (don't jump to right)
					(document.activeElement as HTMLElement)?.blur();
					setFocus('input');
					setSessionListCollapsed(true);
					setTimeout(() => onReturnToInput?.(), 50);
				} else {
					// From center, go to right sidebar
					(document.activeElement as HTMLElement)?.blur();
					if (!isGitExpanded) {
						toggleGit();
					}
					setFocus('git');
					resetGitFileIndex();
				}
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === '/') {
				e.preventDefault();
				toggleSessionList();
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
				e.preventDefault();
				toggleGit();
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
				e.preventDefault();
				onNewSession();
				return;
			}

			if (e.key === 'Escape') {
				e.preventDefault();
				// Close sidebar if focused on one
				if (currentFocus === 'sessions') {
					setSessionListCollapsed(true);
				} else if (currentFocus === 'git') {
					toggleGit();
					closeDiff();
				}
				setFocus('input');
				onReturnToInput?.();
				return;
			}

			if (currentFocus === 'sessions' && !isInInput) {
				if (e.key === 'j' && sessionIds.length > 0) {
					e.preventDefault();
					const nextIndex = Math.min(sessionIndex + 1, sessionIds.length - 1);
					setSessionIndex(nextIndex);
					return;
				}

				if (e.key === 'k' && sessionIds.length > 0) {
					e.preventDefault();
					const prevIndex = Math.max(sessionIndex - 1, 0);
					setSessionIndex(prevIndex);
					return;
				}

				if (e.key === 'Enter' && sessionIds[sessionIndex]) {
					e.preventDefault();
					onSelectSession(sessionIds[sessionIndex]);
					setFocus('input');
					return;
				}
			}

			if (currentFocus === 'git' && !isInInput) {
				if (e.key === 'j' && gitFiles.length > 0) {
					e.preventDefault();
					const nextIndex = Math.min(gitFileIndex + 1, gitFiles.length - 1);
					setGitFileIndex(nextIndex);
					return;
				}

				if (e.key === 'k' && gitFiles.length > 0) {
					e.preventDefault();
					const prevIndex = Math.max(gitFileIndex - 1, 0);
					setGitFileIndex(prevIndex);
					return;
				}

				if (e.key === ' ' && gitFiles[gitFileIndex]) {
					e.preventDefault();
					const file = gitFiles[gitFileIndex];
					if (file.staged) {
						onUnstageFile?.(file.path);
					} else {
						onStageFile?.(file.path);
					}
					return;
				}

				if (e.key === 'a') {
					e.preventDefault();
					onStageAll?.();
					return;
				}

				if (e.key === 'u') {
					e.preventDefault();
					onUnstageAll?.();
					return;
				}

				if (e.key === 'R' && gitFiles[gitFileIndex]) {
					e.preventDefault();
					const file = gitFiles[gitFileIndex];
					// Only allow restore for unstaged, tracked files (not new/untracked)
					const canRestore =
						!file.staged &&
						file.status !== 'untracked' &&
						file.status !== 'added';
					if (canRestore) {
						onRestoreFile?.(file.path);
					}
					return;
				}

				// Delete file - Shift+D or Delete (only for untracked files)
				if ((e.shiftKey && e.key === 'D') || e.key === 'Backspace') {
					e.preventDefault();
					const file = gitFiles[gitFileIndex];
					if (file && !file.staged && file.status === 'untracked') {
						onDeleteFile?.(file.path);
					}
					return;
				}

				if (e.key === 'c') {
					e.preventDefault();
					onOpenCommitModal?.();
					return;
				}

				if (e.key === 'Enter' && gitFiles[gitFileIndex]) {
					e.preventDefault();
					const file = gitFiles[gitFileIndex];
					onViewDiff?.(file.path, file.staged);
					return;
				}
			}
		},
		[
			currentFocus,
			sessionIndex,
			gitFileIndex,
			sessionIds,
			gitFiles,
			currentSessionIndex,
			isGitExpanded,
			setFocus,
			setSessionIndex,
			setGitFileIndex,
			resetGitFileIndex,
			setSessionListCollapsed,
			toggleGit,
			toggleSessionList,
			onSelectSession,
			onNewSession,
			onStageFile,
			onUnstageFile,
			onRestoreFile,
			onDeleteFile,
			onStageAll,
			onUnstageAll,
			onOpenCommitModal,
			onViewDiff,
			onReturnToInput,
			closeDiff,
		],
	);

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	return {
		currentFocus,
		sessionIndex,
		gitFileIndex,
	};
}
