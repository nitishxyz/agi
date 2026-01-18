import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface UseCommandSuggestionsOptions {
	onCommand?: (commandId: string) => void;
	updatePreferences: (prefs: {
		vimMode?: boolean;
		reasoningEnabled?: boolean;
	}) => void;
	vimModeEnabled: boolean;
	reasoningEnabled: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement>;
	setMessage: (msg: string) => void;
	setShowShortcutsModal: (show: boolean) => void;
	sessionId?: string;
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
	reasoningEnabled,
	textareaRef,
	setMessage,
	setShowShortcutsModal,
	sessionId,
}: UseCommandSuggestionsOptions): UseCommandSuggestionsReturn {
	const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
	const [commandQuery, setCommandQuery] = useState('');
	const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
	const [currentCommandToSelect, setCurrentCommandToSelect] = useState<
		string | undefined
	>();

	const handleCommandSelect = useCallback(
		async (commandId: string) => {
			const resetInput = () => {
				setMessage('');
				setShowCommandSuggestions(false);
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
				textareaRef.current?.focus();
			};

			if (commandId === 'help') {
				setShowShortcutsModal(true);
				resetInput();
				return;
			}
			if (commandId === 'vim') {
				updatePreferences({ vimMode: !vimModeEnabled });
				resetInput();
				return;
			}
			if (commandId === 'reasoning') {
				updatePreferences({ reasoningEnabled: !reasoningEnabled });
				resetInput();
				return;
			}
			if (commandId === 'stop') {
				if (sessionId) {
					try {
						await apiClient.abortSession(sessionId);
					} catch (error) {
						console.error('Failed to stop generation:', error);
					}
				}
				resetInput();
				return;
			}
			if (onCommand) {
				onCommand(commandId);
			}
			resetInput();
		},
		[
			onCommand,
			vimModeEnabled,
			reasoningEnabled,
			updatePreferences,
			textareaRef,
			setMessage,
			setShowShortcutsModal,
			sessionId,
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
