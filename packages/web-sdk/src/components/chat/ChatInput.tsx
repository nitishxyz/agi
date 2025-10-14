import {
	useState,
	useRef,
	useEffect,
	useCallback,
	memo,
	forwardRef,
	useImperativeHandle,
} from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { ArrowUp, MoreVertical } from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { FileMentionPopup } from './FileMentionPopup';
import { CommandSuggestionsPopup } from './CommandSuggestionsPopup';
import { ShortcutsModal } from './ShortcutsModal';
import { useFiles } from '../../hooks/useFiles';
import { usePreferences } from '../../hooks/usePreferences';

interface ChatInputProps {
	onSend: (message: string) => void;
	onCommand?: (commandId: string) => void;
	disabled?: boolean;
	onConfigClick?: () => void;
	onPlanModeToggle?: (isPlanMode: boolean) => void;
	isPlanMode?: boolean;
}

export const ChatInput = memo(
	forwardRef<{ focus: () => void }, ChatInputProps>(function ChatInput(
		{
			onSend,
			onCommand,
			disabled,
			onConfigClick,
			onPlanModeToggle,
			isPlanMode: externalIsPlanMode,
		},
		ref,
	) {
		const [message, setMessage] = useState('');
		const [isPlanMode, setIsPlanMode] = useState(externalIsPlanMode || false);
		const [showFileMention, setShowFileMention] = useState(false);
		const [mentionQuery, setMentionQuery] = useState('');
		const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
		const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
		const [commandQuery, setCommandQuery] = useState('');
		const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
		const [showShortcutsModal, setShowShortcutsModal] = useState(false);
		const [currentFileToSelect, setCurrentFileToSelect] = useState<
			string | undefined
		>();
		const [currentCommandToSelect, setCurrentCommandToSelect] = useState<
			string | undefined
		>();
		const [vimMode, setVimMode] = useState<'normal' | 'insert'>('insert');
		const [vimPendingKey, setVimPendingKey] = useState<string>('');
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		const { data: filesData, isLoading: filesLoading } = useFiles();
		const { preferences, updatePreferences } = usePreferences();
		const files = filesData?.files || [];
		const changedFiles = filesData?.changedFiles || [];

		useEffect(() => {
			textareaRef.current?.focus();
		}, []);

		useEffect(() => {
			if (externalIsPlanMode !== undefined) {
				setIsPlanMode(externalIsPlanMode);
			}
		}, [externalIsPlanMode]);

		useEffect(() => {
			if (preferences.vimMode) {
				setVimMode('normal');
			} else {
				setVimMode('insert');
			}
		}, [preferences.vimMode]);

		useImperativeHandle(ref, () => ({
			focus: () => {
				textareaRef.current?.focus();
			},
		}));

		const adjustTextareaHeight = useCallback(() => {
			const textarea = textareaRef.current;
			if (textarea) {
				textarea.style.height = 'auto';
				textarea.style.height = `${textarea.scrollHeight}px`;
			}
		}, []);

		// biome-ignore lint/correctness/useExhaustiveDependencies: message dependency required for adjusting textarea height on content change
		useEffect(() => {
			adjustTextareaHeight();
		}, [adjustTextareaHeight, message]);

		const handleSend = useCallback(() => {
			if (message.trim() && !disabled) {
				onSend(message);
				setMessage('');
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
				if (preferences.vimMode) {
					setVimMode('normal');
				}
				textareaRef.current?.focus();
			}
		}, [message, disabled, onSend, preferences.vimMode]);

		const handleFileSelect = useCallback((filePath: string) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const value = textarea.value;
			const cursorPos = textarea.selectionStart;
			const textBeforeCursor = value.slice(0, cursorPos);

			const match = textBeforeCursor.match(/@(\S*)$/);
			if (!match) return;

			const atPos = cursorPos - match[0].length;
			const newValue = `${value.slice(0, atPos)}@${filePath} ${value.slice(cursorPos)}`;

			setMessage(newValue);
			setShowFileMention(false);

			setTimeout(() => {
				const newCursorPos = atPos + filePath.length + 2;
				textarea.setSelectionRange(newCursorPos, newCursorPos);
				textarea.focus();
			}, 0);
		}, []);

		const handleEnterSelect = useCallback((file: string | undefined) => {
			setCurrentFileToSelect(file);
		}, []);

		const handleCommandEnterSelect = useCallback(
			(commandId: string | undefined) => {
				setCurrentCommandToSelect(commandId);
			},
			[],
		);

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
					const newVimMode = !preferences.vimMode;
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
			[onCommand, preferences.vimMode, updatePreferences],
		);

		const handleChange = useCallback(
			(e: ChangeEvent<HTMLTextAreaElement>) => {
				if (preferences.vimMode && vimMode === 'normal') {
					return;
				}

				setMessage(e.target.value);
				const value = e.target.value;

				if (value.startsWith('/') && !value.includes(' ')) {
					setShowCommandSuggestions(true);
					setCommandQuery(value.slice(1));
					setCommandSelectedIndex(0);
					setShowFileMention(false);
				} else {
					setShowCommandSuggestions(false);

					const cursorPos = e.target.selectionStart;
					const textBeforeCursor = value.slice(0, cursorPos);
					const match = textBeforeCursor.match(/@(\S*)$/);

					if (match) {
						setShowFileMention(true);
						setMentionQuery(match[1]);
						setMentionSelectedIndex(0);
					} else {
						setShowFileMention(false);
					}
				}
			},
			[preferences.vimMode, vimMode],
		);

		const handleVimNormalMode = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
				const textarea = textareaRef.current;
				if (!textarea) return false;

				const key = e.key;

				// Helper function to find word boundaries
				const findNextWordStart = (text: string, pos: number): number => {
					// Skip current word
					while (pos < text.length && /\S/.test(text[pos])) pos++;
					// Skip whitespace
					while (pos < text.length && /\s/.test(text[pos])) pos++;
					return Math.min(pos, text.length);
				};

				const findNextWordEnd = (text: string, pos: number): number => {
					// Move forward one if at word end
					if (pos < text.length && /\S/.test(text[pos])) pos++;
					// Skip whitespace
					while (pos < text.length && /\s/.test(text[pos])) pos++;
					// Find end of word
					while (pos < text.length && /\S/.test(text[pos])) pos++;
					return Math.max(0, pos - 1);
				};

				const findPrevWordStart = (text: string, pos: number): number => {
					// Move back one
					pos = Math.max(0, pos - 1);
					// Skip whitespace
					while (pos > 0 && /\s/.test(text[pos])) pos--;
					// Find start of word
					while (pos > 0 && /\S/.test(text[pos - 1])) pos--;
					return pos;
				};

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

				// Handle f{char} - find character
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
							text.lastIndexOf('\n', textarea.selectionStart - 1) +
							1 +
							charIndex;
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
					handleSend();
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

				return false;
			},
			[vimPendingKey, handleSend],
		);

		const handleKeyDown = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
				if (showCommandSuggestions) {
					if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
						e.preventDefault();
						setCommandSelectedIndex((prev) => (prev + 1) % 5);
					} else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
						e.preventDefault();
						setCommandSelectedIndex((prev) => (prev - 1 + 5) % 5);
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
						setMentionSelectedIndex((prev) => (prev + 1) % 20);
					} else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
						e.preventDefault();
						setMentionSelectedIndex((prev) => (prev - 1 + 20) % 20);
					} else if (e.key === 'Enter') {
						e.preventDefault();
						if (currentFileToSelect) {
							handleFileSelect(currentFileToSelect);
						}
					} else if (e.key === 'Escape') {
						e.preventDefault();
						setShowFileMention(false);
						if (preferences.vimMode) {
							setVimMode('normal');
						}
					}
					return;
				}

				if (preferences.vimMode && vimMode === 'normal') {
					const handled = handleVimNormalMode(e);
					if (handled) return;
				}

				if (preferences.vimMode && vimMode === 'insert' && e.key === 'Escape') {
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
					(!preferences.vimMode || vimMode === 'normal')
				) {
					e.preventDefault();
					handleSend();
				}
			},
			[
				showFileMention,
				showCommandSuggestions,
				handleSend,
				isPlanMode,
				onPlanModeToggle,
				currentFileToSelect,
				handleFileSelect,
				currentCommandToSelect,
				handleCommandSelect,
				preferences.vimMode,
				vimMode,
				handleVimNormalMode,
			],
		);

		return (
			<div className="absolute bottom-0 left-0 right-0 pt-16 pb-6 md:pb-8 px-2 md:px-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-20 safe-area-inset-bottom">
				<div className="max-w-3xl mx-auto pointer-events-auto mb-2 md:mb-0 relative">
					{preferences.vimMode && vimMode === 'normal' && (
						<div className="absolute -top-6 right-0 px-2 py-0.5 text-xs font-mono font-semibold bg-amber-500/90 text-white rounded shadow-sm">
							NORMAL
						</div>
					)}
					{preferences.vimMode && vimMode === 'insert' && (
						<div className="absolute -top-6 right-0 px-2 py-0.5 text-xs font-mono font-semibold bg-green-500/90 text-white rounded shadow-sm">
							INSERT
						</div>
					)}
					<div
						className={`flex items-end gap-1 rounded-3xl p-1 transition-all touch-manipulation ${
							isPlanMode
								? 'bg-slate-100 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 focus-within:border-slate-400 dark:focus-within:border-slate-600 focus-within:ring-1 focus-within:ring-slate-300 dark:focus-within:ring-slate-700'
								: 'bg-card border border-border focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40'
						}`}
					>
						{onConfigClick && (
							<button
								type="button"
								onClick={onConfigClick}
								className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-background/50 active:bg-background/70 transition-colors text-muted-foreground hover:text-foreground flex-shrink-0 touch-manipulation"
							>
								<MoreVertical className="w-4 h-4" />
							</button>
						)}
						<Textarea
							ref={textareaRef}
							value={message}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							placeholder={
								isPlanMode
									? 'Plan mode - Type a message...'
									: 'Type a message...'
							}
							disabled={disabled}
							rows={1}
							className={`border-0 bg-transparent pl-1 pr-2 py-2 max-h-[200px] overflow-y-auto leading-normal resize-none scrollbar-hide text-base ${
								preferences.vimMode && vimMode === 'normal' ? 'caret-[6px]' : ''
							}`}
							style={{ height: '2.5rem' }}
						/>
						<button
							type="button"
							onClick={handleSend}
							disabled={disabled || !message.trim()}
							className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors flex-shrink-0 touch-manipulation ${
								message.trim()
									? 'bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground'
									: 'bg-transparent text-muted-foreground'
							}`}
						>
							<ArrowUp className="w-4 h-4" />
						</button>
					</div>

					{showFileMention && !filesLoading && (
						<FileMentionPopup
							files={files}
							changedFiles={changedFiles}
							query={mentionQuery}
							selectedIndex={mentionSelectedIndex}
							onSelect={handleFileSelect}
							onEnterSelect={handleEnterSelect}
							onClose={() => setShowFileMention(false)}
						/>
					)}

					{showCommandSuggestions && (
						<CommandSuggestionsPopup
							query={commandQuery}
							selectedIndex={commandSelectedIndex}
							onSelect={handleCommandSelect}
							onEnterSelect={handleCommandEnterSelect}
							onClose={() => setShowCommandSuggestions(false)}
						/>
					)}

					<ShortcutsModal
						isOpen={showShortcutsModal}
						onClose={() => setShowShortcutsModal(false)}
					/>
				</div>
			</div>
		);
	}),
);
