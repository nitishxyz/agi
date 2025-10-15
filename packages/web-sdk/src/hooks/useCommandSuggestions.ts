import { useState, useCallback } from 'react';

interface UseCommandSuggestionsOptions {
	onCommand?: (commandId: string) => void;
	updatePreferences: (prefs: { vimMode: boolean }) => void;
	vimModeEnabled: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement>;
	setMessage: (msg: string) => void;
	setShowShortcutsModal: (show: boolean) => void;
}

interface UseCommandSuggestionsReturn {
	showCommandSuggestions: boolean;
	commandQuery: string;
	commandSelectedIndex: number;
	currentCommandToSelect: string | undefined;
	setShowCommandSuggestions: (show: boolean) => void;
	setCommandQuery: (query: string) => void;
	setCommandSelectedIndex: (index: number) => void;
	setCurrentCommandToSelect: (commandId: string | undefined) => void;
	handleCommandSelect: (commandId: string) => void;
	handleCommandEnterSelect: (commandId: string | undefined) => void;
	checkForCommand: (value: string) => void;
}

export function useCommandSuggestions({
	onCommand,
	updatePreferences,
	vimModeEnabled,
	textareaRef,
	setMessage,
	setShowShortcutsModal,
}: UseCommandSuggestionsOptions): UseCommandSuggestionsReturn {
	const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
	const [commandQuery, setCommandQuery] = useState('');
	const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
	const [currentCommandToSelect, setCurrentCommandToSelect] = useState<
		string | undefined
	>();

	const handleCommandSelect = useCallback(
		(commandId: string) => {
			if (commandId === 'help') {
				setShowShortcutsModal(true);
				setMessage('');
				setShowCommandSuggestions(false);
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
				textareaRef.current?.focus();
				return;
			}
			if (commandId === 'vim') {
				const newVimMode = !vimModeEnabled;
				updatePreferences({ vimMode: newVimMode });
				setMessage('');
				setShowCommandSuggestions(false);
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
				textareaRef.current?.focus();
				return;
			}
			if (onCommand) {
				onCommand(commandId);
			}
			setMessage('');
			setShowCommandSuggestions(false);
			if (textareaRef.current) {
				textareaRef.current.style.height = 'auto';
			}
			textareaRef.current?.focus();
		},
		[
			onCommand,
			vimModeEnabled,
			updatePreferences,
			textareaRef,
			setMessage,
			setShowShortcutsModal,
		],
	);

	const handleCommandEnterSelect = useCallback(
		(commandId: string | undefined) => {
			setCurrentCommandToSelect(commandId);
		},
		[],
	);

	const checkForCommand = useCallback((value: string) => {
		if (value.startsWith('/') && !value.includes(' ')) {
			setShowCommandSuggestions(true);
			setCommandQuery(value.slice(1));
			setCommandSelectedIndex(0);
		} else {
			setShowCommandSuggestions(false);
		}
	}, []);

	return {
		showCommandSuggestions,
		commandQuery,
		commandSelectedIndex,
		currentCommandToSelect,
		setShowCommandSuggestions,
		setCommandQuery,
		setCommandSelectedIndex,
		setCurrentCommandToSelect,
		handleCommandSelect,
		handleCommandEnterSelect,
		checkForCommand,
	};
}
