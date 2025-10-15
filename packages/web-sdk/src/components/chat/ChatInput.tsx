import {
	useState,
	useRef,
	useEffect,
	useCallback,
	memo,
	forwardRef,
	useImperativeHandle,
	useMemo,
} from 'react';
import type { ChangeEvent } from 'react';
import { ArrowUp, MoreVertical } from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { FileMentionPopup } from './FileMentionPopup';
import { CommandSuggestionsPopup } from './CommandSuggestionsPopup';
import { ShortcutsModal } from './ShortcutsModal';
import { useFiles } from '../../hooks/useFiles';
import { usePreferences } from '../../hooks/usePreferences';
import { useVimMode } from '../../hooks/useVimMode';
import { useFileMention } from '../../hooks/useFileMention';
import { useCommandSuggestions } from '../../hooks/useCommandSuggestions';
import { createChatInputKeyHandler } from './ChatInputKeyHandler';

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
		const [showShortcutsModal, setShowShortcutsModal] = useState(false);
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		const { data: filesData, isLoading: filesLoading } = useFiles();
		const { preferences, updatePreferences } = usePreferences();
		const files = filesData?.files || [];
		const changedFiles = filesData?.changedFiles || [];

		const handleSendRef = useRef<() => void>(() => {});

		const {
			showFileMention,
			mentionQuery,
			mentionSelectedIndex,
			currentFileToSelect,
			setShowFileMention,
			setMentionSelectedIndex,
			setCurrentFileToSelect,
			handleFileSelect: selectFile,
			handleEnterSelect: handleMentionEnterSelect,
			checkForMention,
		} = useFileMention();

		const {
			showCommandSuggestions,
			commandQuery,
			commandSelectedIndex,
			currentCommandToSelect,
			setShowCommandSuggestions,
			setCommandSelectedIndex,
			setCurrentCommandToSelect,
			handleCommandSelect,
			handleCommandEnterSelect,
			checkForCommand,
		} = useCommandSuggestions({
			onCommand,
			updatePreferences,
			vimModeEnabled: preferences.vimMode,
			textareaRef,
			setMessage,
			setShowShortcutsModal,
		});

		const { vimMode, setVimMode, handleVimNormalMode } = useVimMode({
			enabled: preferences.vimMode,
			onSend: () => handleSendRef.current(),
			textareaRef,
			setMessage,
		});

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
			if (!textarea) return;
			textarea.style.height = 'auto';
			textarea.style.height = `${textarea.scrollHeight}px`;
		}, []);

		// biome-ignore lint/correctness/useExhaustiveDependencies: message dependency required for adjusting textarea height on content change
		useEffect(() => {
			adjustTextareaHeight();
		}, [adjustTextareaHeight, message]);

		const handleMentionClose = useCallback(() => {
			setShowFileMention(false);
			setCurrentFileToSelect(undefined);
		}, [setShowFileMention, setCurrentFileToSelect]);

		const handleCommandClose = useCallback(() => {
			setShowCommandSuggestions(false);
			setCurrentCommandToSelect(undefined);
		}, [setShowCommandSuggestions, setCurrentCommandToSelect]);

		const handleMentionSelect = useCallback(
			(filePath: string) => {
				selectFile(filePath, textareaRef, setMessage);
			},
			[selectFile],
		);

		const handleSend = useCallback(() => {
			if (!message.trim() || disabled) return;

			onSend(message);
			setMessage('');
			setShowFileMention(false);
			setShowCommandSuggestions(false);
			setCurrentFileToSelect(undefined);
			setCurrentCommandToSelect(undefined);

			if (textareaRef.current) {
				textareaRef.current.style.height = 'auto';
			}

			if (preferences.vimMode) {
				setVimMode('normal');
			}

			textareaRef.current?.focus();
		}, [
			message,
			disabled,
			onSend,
			preferences.vimMode,
			setShowFileMention,
			setShowCommandSuggestions,
			setCurrentFileToSelect,
			setCurrentCommandToSelect,
			setVimMode,
		]);

		useEffect(() => {
			handleSendRef.current = handleSend;
		}, [handleSend]);

		const handleChange = useCallback(
			(e: ChangeEvent<HTMLTextAreaElement>) => {
				if (preferences.vimMode && vimMode === 'normal') {
					return;
				}

				const value = e.target.value;
				setMessage(value);

				checkForCommand(value);

				if (value.startsWith('/') && !value.includes(' ')) {
					setShowFileMention(false);
					setCurrentFileToSelect(undefined);
				} else {
					setShowCommandSuggestions(false);
					setCurrentCommandToSelect(undefined);
					checkForMention(value, e.target.selectionStart);
				}
			},
			[
				preferences.vimMode,
				vimMode,
				checkForCommand,
				setShowFileMention,
				setCurrentFileToSelect,
				setShowCommandSuggestions,
				setCurrentCommandToSelect,
				checkForMention,
			],
		);

		const handleKeyDown = useMemo(
			() =>
				createChatInputKeyHandler({
					showFileMention,
					showCommandSuggestions,
					mentionSelectedIndex,
					commandSelectedIndex,
					currentFileToSelect,
					currentCommandToSelect,
					isPlanMode,
					vimModeEnabled: preferences.vimMode,
					vimMode,
					setMentionSelectedIndex,
					setCommandSelectedIndex,
					setShowFileMention,
					setShowCommandSuggestions,
					setIsPlanMode,
					setVimMode,
					handleFileSelect: handleMentionSelect,
					handleCommandSelect,
					handleSend,
					handleVimNormalMode,
					onPlanModeToggle,
				}),
			[
				showFileMention,
				showCommandSuggestions,
				mentionSelectedIndex,
				commandSelectedIndex,
				currentFileToSelect,
				currentCommandToSelect,
				isPlanMode,
				preferences.vimMode,
				vimMode,
				setMentionSelectedIndex,
				setCommandSelectedIndex,
				setShowFileMention,
				setShowCommandSuggestions,
				setVimMode,
				handleMentionSelect,
				handleCommandSelect,
				handleSend,
				handleVimNormalMode,
				onPlanModeToggle,
			],
		);

		useEffect(() => {
			if (!preferences.vimMode) {
				setVimMode('insert');
			}
		}, [preferences.vimMode, setVimMode]);

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
							onSelect={handleMentionSelect}
							onEnterSelect={handleMentionEnterSelect}
							onClose={handleMentionClose}
						/>
					)}

					{showCommandSuggestions && (
						<CommandSuggestionsPopup
							query={commandQuery}
							selectedIndex={commandSelectedIndex}
							onSelect={handleCommandSelect}
							onEnterSelect={handleCommandEnterSelect}
							onClose={handleCommandClose}
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
