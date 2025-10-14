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
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		const { data: filesData, isLoading: filesLoading } = useFiles();
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
				textareaRef.current?.focus();
			}
		}, [message, disabled, onSend]);

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

		const handleCommandEnterSelect = useCallback((commandId: string | undefined) => {
			setCurrentCommandToSelect(commandId);
		}, []);

	const handleCommandSelect = useCallback((commandId: string) => {
		if (commandId === 'shortcuts' || commandId === 'help') {
			setShowShortcutsModal(true);
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
		}, [onCommand]);

		const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
			setMessage(e.target.value);
			const value = e.target.value;

			// Check for slash command (only when input starts with /)
			if (value.startsWith('/') && !value.includes(' ')) {
				setShowCommandSuggestions(true);
				setCommandQuery(value.slice(1));
				setCommandSelectedIndex(0);
				setShowFileMention(false);
			} else {
				setShowCommandSuggestions(false);
				
				// Check for file mention
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
		}, []);

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
					}
				return;
			}

			if (e.key === 'Tab') {
				e.preventDefault();
				const newPlanMode = !isPlanMode;
				setIsPlanMode(newPlanMode);
				onPlanModeToggle?.(newPlanMode);
			} else if (e.key === 'Enter' && !e.shiftKey) {
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
		],
	);

	return (
			<div className="absolute bottom-0 left-0 right-0 pt-16 pb-6 md:pb-8 px-2 md:px-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-20 safe-area-inset-bottom">
				<div className="max-w-3xl mx-auto pointer-events-auto mb-2 md:mb-0 relative">
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
							className="border-0 bg-transparent pl-1 pr-2 py-2 max-h-[200px] overflow-y-auto leading-normal resize-none scrollbar-hide text-base"
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
