import { useState, useCallback } from 'react';

interface UseFileMentionReturn {
	showFileMention: boolean;
	mentionQuery: string;
	mentionSelectedIndex: number;
	currentFileToSelect: string | undefined;
	setShowFileMention: (show: boolean) => void;
	setMentionQuery: (query: string) => void;
	setMentionSelectedIndex: (index: number) => void;
	setCurrentFileToSelect: (file: string | undefined) => void;
	handleFileSelect: (
		filePath: string,
		textareaRef: React.RefObject<HTMLTextAreaElement>,
		setMessage: (msg: string) => void,
	) => void;
	handleEnterSelect: (file: string | undefined) => void;
	checkForMention: (value: string, cursorPos: number) => void;
}

export function useFileMention(): UseFileMentionReturn {
	const [showFileMention, setShowFileMention] = useState(false);
	const [mentionQuery, setMentionQuery] = useState('');
	const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
	const [currentFileToSelect, setCurrentFileToSelect] = useState<
		string | undefined
	>();

	const handleFileSelect = useCallback(
		(
			filePath: string,
			textareaRef: React.RefObject<HTMLTextAreaElement>,
			setMessage: (msg: string) => void,
		) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const value = textarea.value;
			const cursorPos = textarea.selectionStart;
			const textBeforeCursor = value.slice(0, cursorPos);

			const match = textBeforeCursor.match(/(^|[\s])@(\S*)$/);
			if (!match) return;

			const atPos = cursorPos - match[0].length + match[1].length;
			const newValue = `${value.slice(0, atPos)}@${filePath} ${value.slice(cursorPos)}`;

			setMessage(newValue);
			setShowFileMention(false);

			setTimeout(() => {
				const newCursorPos = atPos + filePath.length + 2;
				textarea.setSelectionRange(newCursorPos, newCursorPos);
				textarea.focus();
			}, 0);
		},
		[],
	);

	const handleEnterSelect = useCallback((file: string | undefined) => {
		setCurrentFileToSelect(file);
	}, []);

	const checkForMention = useCallback((value: string, cursorPos: number) => {
		const textBeforeCursor = value.slice(0, cursorPos);
		const match = textBeforeCursor.match(/(^|[\s])@(\S*)$/);

		if (match) {
			setShowFileMention(true);
			setMentionQuery(match[2]);
			setMentionSelectedIndex(0);
		} else {
			setShowFileMention(false);
		}
	}, []);

	return {
		showFileMention,
		mentionQuery,
		mentionSelectedIndex,
		currentFileToSelect,
		setShowFileMention,
		setMentionQuery,
		setMentionSelectedIndex,
		setCurrentFileToSelect,
		handleFileSelect,
		handleEnterSelect,
		checkForMention,
	};
}
