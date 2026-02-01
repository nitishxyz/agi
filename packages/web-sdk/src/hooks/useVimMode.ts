import { useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';

export type VimMode = 'normal' | 'insert';

interface UseVimModeOptions {
	enabled: boolean;
	onSend: () => void;
	textareaRef: React.RefObject<HTMLTextAreaElement>;
	setMessage: (message: string) => void;
}

interface UseVimModeReturn {
	vimMode: VimMode;
	setVimMode: (mode: VimMode) => void;
	handleVimNormalMode: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

export function useVimMode({
	enabled,
	onSend,
	textareaRef,
	setMessage,
}: UseVimModeOptions): UseVimModeReturn {
	const [vimMode, setVimMode] = useState<VimMode>(
		enabled ? 'normal' : 'insert',
	);
	const [vimPendingKey, setVimPendingKey] = useState<string>('');

	const findNextWordStart = useCallback((text: string, pos: number): number => {
		while (pos < text.length && /\S/.test(text[pos])) pos++;
		while (pos < text.length && /\s/.test(text[pos])) pos++;
		return Math.min(pos, text.length);
	}, []);

	const findNextWordEnd = useCallback((text: string, pos: number): number => {
		if (pos < text.length && /\S/.test(text[pos])) pos++;
		while (pos < text.length && /\s/.test(text[pos])) pos++;
		while (pos < text.length && /\S/.test(text[pos])) pos++;
		return Math.max(0, pos - 1);
	}, []);

	const findPrevWordStart = useCallback((text: string, pos: number): number => {
		pos = Math.max(0, pos - 1);
		while (pos > 0 && /\s/.test(text[pos])) pos--;
		while (pos > 0 && /\S/.test(text[pos - 1])) pos--;
		return pos;
	}, []);

	const handleVimNormalMode = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
			const textarea = textareaRef.current;
			if (!textarea) return false;

			const key = e.key;

			if (key === 'i') {
				e.preventDefault();
				setVimMode('insert');
				return true;
			}

			if (key === 'a') {
				e.preventDefault();
				setVimMode('insert');
				const pos = textarea.selectionStart;
				setTimeout(() => {
					textarea.setSelectionRange(pos + 1, pos + 1);
				}, 0);
				return true;
			}

			if (key === 'I') {
				e.preventDefault();
				setVimMode('insert');
				const text = textarea.value;
				const lineStart =
					text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
				setTimeout(() => {
					textarea.setSelectionRange(lineStart, lineStart);
				}, 0);
				return true;
			}

			if (key === 'A') {
				e.preventDefault();
				setVimMode('insert');
				const text = textarea.value;
				let lineEnd = text.indexOf('\n', textarea.selectionStart);
				if (lineEnd === -1) lineEnd = text.length;
				setTimeout(() => {
					textarea.setSelectionRange(lineEnd, lineEnd);
				}, 0);
				return true;
			}

			if (key === '0') {
				e.preventDefault();
				const text = textarea.value;
				const lineStart =
					text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
				textarea.setSelectionRange(lineStart, lineStart);
				return true;
			}

			if (key === '$') {
				e.preventDefault();
				const text = textarea.value;
				let lineEnd = text.indexOf('\n', textarea.selectionStart);
				if (lineEnd === -1) lineEnd = text.length;
				textarea.setSelectionRange(lineEnd, lineEnd);
				return true;
			}

			if (key === 'o') {
				e.preventDefault();
				setVimMode('insert');
				const text = textarea.value;
				let lineEnd = text.indexOf('\n', textarea.selectionStart);
				if (lineEnd === -1) lineEnd = text.length;

				const newValue = `${text.slice(0, lineEnd)}\n${text.slice(lineEnd)}`;
				setMessage(newValue);

				setTimeout(() => {
					textarea.setSelectionRange(lineEnd + 1, lineEnd + 1);
				}, 0);
				return true;
			}

			if (key === 'O') {
				e.preventDefault();
				setVimMode('insert');
				const text = textarea.value;
				const lineStart =
					text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;

				const newValue = `${text.slice(0, lineStart)}\n${text.slice(lineStart)}`;
				setMessage(newValue);

				setTimeout(() => {
					textarea.setSelectionRange(lineStart, lineStart);
				}, 0);
				return true;
			}

			if (vimPendingKey === 'f' && key.length === 1 && key !== 'Escape') {
				e.preventDefault();
				const text = textarea.value;
				const currentLine = text.slice(
					text.lastIndexOf('\n', textarea.selectionStart - 1) + 1,
					text.indexOf('\n', textarea.selectionStart) === -1
						? text.length
						: text.indexOf('\n', textarea.selectionStart),
				);
				const posInLine =
					textarea.selectionStart -
					text.lastIndexOf('\n', textarea.selectionStart - 1) -
					1;
				const charIndex = currentLine.indexOf(key, posInLine + 1);

				if (charIndex !== -1) {
					const newPos =
						text.lastIndexOf('\n', textarea.selectionStart - 1) + 1 + charIndex;
					textarea.setSelectionRange(newPos, newPos);
				}

				setVimPendingKey('');
				return true;
			}

			if (key === 'f') {
				e.preventDefault();
				setVimPendingKey('f');
				setTimeout(() => setVimPendingKey(''), 2000);
				return true;
			}

			if (key === 'd') {
				if (vimPendingKey === 'd') {
					e.preventDefault();
					const text = textarea.value;
					const lineStart =
						text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
					let lineEnd = text.indexOf('\n', textarea.selectionStart);
					if (lineEnd === -1) lineEnd = text.length;
					else lineEnd += 1;

					const newValue = text.slice(0, lineStart) + text.slice(lineEnd);
					setMessage(newValue);
					setVimPendingKey('');

					setTimeout(() => {
						textarea.setSelectionRange(lineStart, lineStart);
					}, 0);
					return true;
				}
				e.preventDefault();
				setVimPendingKey('d');
				setTimeout(() => setVimPendingKey(''), 1000);
				return true;
			}

			if (key === 'Enter') {
				e.preventDefault();
				onSend();
				return true;
			}

			if (key === 'Escape') {
				e.preventDefault();
				return true;
			}

			if (key === 'w') {
				e.preventDefault();
				const text = textarea.value;
				const newPos = findNextWordStart(text, textarea.selectionStart);
				textarea.setSelectionRange(newPos, newPos);
				return true;
			}

			if (key === 'e') {
				e.preventDefault();
				const text = textarea.value;
				const newPos = findNextWordEnd(text, textarea.selectionStart);
				textarea.setSelectionRange(newPos, newPos);
				return true;
			}

			if (key === 'b') {
				e.preventDefault();
				const text = textarea.value;
				const newPos = findPrevWordStart(text, textarea.selectionStart);
				textarea.setSelectionRange(newPos, newPos);
				return true;
			}

			if (key === 'x') {
				e.preventDefault();
				const text = textarea.value;
				const pos = textarea.selectionStart;
				if (pos < text.length) {
					const newValue = text.slice(0, pos) + text.slice(pos + 1);
					setMessage(newValue);
					setTimeout(() => {
						textarea.setSelectionRange(pos, pos);
					}, 0);
				}
				return true;
			}

			if (key === 's') {
				e.preventDefault();
				const text = textarea.value;
				const pos = textarea.selectionStart;
				if (pos < text.length) {
					const newValue = text.slice(0, pos) + text.slice(pos + 1);
					setMessage(newValue);
					setVimMode('insert');
					setTimeout(() => {
						textarea.setSelectionRange(pos, pos);
					}, 0);
				} else {
					setVimMode('insert');
				}
				return true;
			}

			if (key === 'S') {
				e.preventDefault();
				const text = textarea.value;
				const lineStart =
					text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
				let lineEnd = text.indexOf('\n', textarea.selectionStart);
				if (lineEnd === -1) lineEnd = text.length;

				const newValue = text.slice(0, lineStart) + text.slice(lineEnd);
				setMessage(newValue);
				setVimMode('insert');

				setTimeout(() => {
					textarea.setSelectionRange(lineStart, lineStart);
				}, 0);
				return true;
			}

			if (key === 'h') {
				e.preventDefault();
				const pos = textarea.selectionStart;
				if (pos > 0) {
					textarea.setSelectionRange(pos - 1, pos - 1);
				}
				return true;
			}

			if (key === 'l') {
				e.preventDefault();
				const pos = textarea.selectionStart;
				if (pos < textarea.value.length) {
					textarea.setSelectionRange(pos + 1, pos + 1);
				}
				return true;
			}

			if (key === 'j') {
				e.preventDefault();
				const text = textarea.value;
				const pos = textarea.selectionStart;
				const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
				const col = pos - lineStart;
				const lineEnd = text.indexOf('\n', pos);
				if (lineEnd !== -1) {
					const nextLineStart = lineEnd + 1;
					let nextLineEnd = text.indexOf('\n', nextLineStart);
					if (nextLineEnd === -1) nextLineEnd = text.length;
					const nextLineLen = nextLineEnd - nextLineStart;
					const newPos = nextLineStart + Math.min(col, nextLineLen);
					textarea.setSelectionRange(newPos, newPos);
				}
				return true;
			}

			if (key === 'k') {
				e.preventDefault();
				const text = textarea.value;
				const pos = textarea.selectionStart;
				const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
				if (lineStart > 0) {
					const col = pos - lineStart;
					const prevLineEnd = lineStart - 1;
					const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
					const prevLineLen = prevLineEnd - prevLineStart;
					const newPos = prevLineStart + Math.min(col, prevLineLen);
					textarea.setSelectionRange(newPos, newPos);
				}
				return true;
			}

			return false;
		},
		[
			vimPendingKey,
			onSend,
			textareaRef,
			setMessage,
			findNextWordStart,
			findNextWordEnd,
			findPrevWordStart,
		],
	);

	return {
		vimMode,
		setVimMode,
		handleVimNormalMode,
	};
}
