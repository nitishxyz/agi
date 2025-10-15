import type { KeyboardEvent } from 'react';
import type { VimMode } from '../../hooks/useVimMode';

interface ChatInputKeyHandlerOptions {
	showFileMention: boolean;
	showCommandSuggestions: boolean;
	mentionSelectedIndex: number;
	commandSelectedIndex: number;
	currentFileToSelect: string | undefined;
	currentCommandToSelect: string | undefined;
	isPlanMode: boolean;
	vimModeEnabled: boolean;
	vimMode: VimMode;
	setMentionSelectedIndex: (index: number) => void;
	setCommandSelectedIndex: (index: number) => void;
	setShowFileMention: (show: boolean) => void;
	setShowCommandSuggestions: (show: boolean) => void;
	setIsPlanMode: (mode: boolean) => void;
	setVimMode: (mode: VimMode) => void;
	handleFileSelect: (file: string) => void;
	handleCommandSelect: (commandId: string) => void;
	handleSend: () => void;
	handleVimNormalMode: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
	onPlanModeToggle?: (isPlanMode: boolean) => void;
}

export function createChatInputKeyHandler(options: ChatInputKeyHandlerOptions) {
	return (e: KeyboardEvent<HTMLTextAreaElement>) => {
		const {
			showFileMention,
			showCommandSuggestions,
			mentionSelectedIndex,
			commandSelectedIndex,
			currentFileToSelect,
			currentCommandToSelect,
			isPlanMode,
			vimModeEnabled,
			vimMode,
			setMentionSelectedIndex,
			setCommandSelectedIndex,
			setShowFileMention,
			setShowCommandSuggestions,
			setIsPlanMode,
			setVimMode,
			handleFileSelect,
			handleCommandSelect,
			handleSend,
			handleVimNormalMode,
			onPlanModeToggle,
		} = options;

		if (showCommandSuggestions) {
			if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
				e.preventDefault();
				setCommandSelectedIndex((commandSelectedIndex + 1) % 5);
			} else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
				e.preventDefault();
				setCommandSelectedIndex((commandSelectedIndex - 1 + 5) % 5);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (currentCommandToSelect) {
					handleCommandSelect(currentCommandToSelect);
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				setShowCommandSuggestions(false);
			}
			return;
		}

		if (showFileMention) {
			if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
				e.preventDefault();
				setMentionSelectedIndex((mentionSelectedIndex + 1) % 20);
			} else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
				e.preventDefault();
				setMentionSelectedIndex((mentionSelectedIndex - 1 + 20) % 20);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (currentFileToSelect) {
					handleFileSelect(currentFileToSelect);
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				setShowFileMention(false);
				if (vimModeEnabled) {
					setVimMode('normal');
				}
			}
			return;
		}

		if (vimModeEnabled && vimMode === 'normal') {
			const handled = handleVimNormalMode(e);
			if (handled) return;
		}

		if (vimModeEnabled && vimMode === 'insert' && e.key === 'Escape') {
			e.preventDefault();
			setVimMode('normal');
			return;
		}

		if (e.key === 'Tab') {
			e.preventDefault();
			const newPlanMode = !isPlanMode;
			setIsPlanMode(newPlanMode);
			onPlanModeToggle?.(newPlanMode);
		} else if (
			e.key === 'Enter' &&
			!e.shiftKey &&
			(!vimModeEnabled || vimMode === 'normal')
		) {
			e.preventDefault();
			handleSend();
		}
	};
}
