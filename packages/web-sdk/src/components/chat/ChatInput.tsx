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
import type { ChangeEvent, ClipboardEvent } from 'react';

import {
	ArrowUp,
	MoreVertical,
	X,
	ImageIcon,
	Brain,
	FileText,
	FileIcon,
	FlaskConical,
	RefreshCw,
} from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { FileMentionPopup } from './FileMentionPopup';
import { CommandSuggestionsPopup } from './CommandSuggestionsPopup';
import { ShortcutsModal } from './ShortcutsModal';
import { ProviderLogo } from '../common/ProviderLogo';
import { useFiles } from '../../hooks/useFiles';
import { usePreferences } from '../../hooks/usePreferences';
import { useVimMode } from '../../hooks/useVimMode';
import { useFileMention } from '../../hooks/useFileMention';
import { useCommandSuggestions } from '../../hooks/useCommandSuggestions';
import { createChatInputKeyHandler } from './ChatInputKeyHandler';
import { useSetuStore } from '../../stores/setuStore';
import type { FileAttachment } from '../../hooks/useFileUpload';

interface ChatInputProps {
	onSend: (message: string) => void;
	onCommand?: (commandId: string) => void;
	disabled?: boolean;
	onConfigClick?: () => void;
	onPlanModeToggle?: (isPlanMode: boolean) => void;
	isPlanMode?: boolean;
	reasoningEnabled?: boolean;
	sessionId?: string;
	images?: FileAttachment[];
	documents?: FileAttachment[];
	onFileRemove?: (id: string) => void;
	isDragging?: boolean;
	onPaste?: (e: ClipboardEvent) => void;
	visionEnabled?: boolean;
	modelName?: string;
	providerName?: string;
	authType?: 'api' | 'oauth' | 'wallet';
	researchContexts?: Array<{ id: string; label: string }>;
	onResearchContextRemove?: (id: string) => void;
	onRefreshBalance?: () => void;
	isBalanceLoading?: boolean;
	onModelInfoClick?: () => void;
}

export const ChatInput = memo(
	forwardRef<
		{ focus: () => void; setValue: (value: string) => void },
		ChatInputProps
	>(function ChatInput(
		{
			onSend,
			onCommand,
			disabled,
			onConfigClick,
			onPlanModeToggle,
			isPlanMode: externalIsPlanMode,
			reasoningEnabled,
			sessionId,
			images = [],
			documents = [],
			onFileRemove,
			isDragging = false,
			onPaste,
			visionEnabled = false,
			modelName,
			providerName,
			authType,
			researchContexts = [],
			onResearchContextRemove,
			onRefreshBalance,
			isBalanceLoading = false,
			onModelInfoClick,
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

		const setuBalance = useSetuStore((s) => s.balance);
		const isSetu = providerName === 'setu';

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
			reasoningEnabled: preferences.reasoningEnabled,
			textareaRef,
			setMessage,
			setShowShortcutsModal,
			sessionId,
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
			setValue: (value: string) => {
				setMessage(value);
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

		const handleTextareaPaste = useCallback(
			(e: ClipboardEvent<HTMLTextAreaElement>) => {
				onPaste?.(e as unknown as ClipboardEvent);
			},
			[onPaste],
		);

		const hasImages = images.length > 0;
		const hasDocuments = documents.length > 0;
		const hasFiles = hasImages || hasDocuments;

		return (
			<>
				{isDragging && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
						<div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border-2 border-dashed border-primary/50">
							<div className="p-4 rounded-full bg-primary/10">
								<FileIcon className="w-12 h-12 text-primary" />
							</div>
							<div className="text-center">
								<p className="text-lg font-medium text-foreground">
									Drop files here
								</p>
								<p className="text-sm text-muted-foreground">
									Images, PDF, Markdown, Text up to 10MB
								</p>
							</div>
						</div>
					</div>
				)}
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
							className={`relative flex flex-col rounded-3xl p-1 transition-all touch-manipulation ${
								isPlanMode
									? 'bg-slate-100 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 focus-within:border-slate-400 dark:focus-within:border-slate-600 focus-within:ring-1 focus-within:ring-slate-300 dark:focus-within:ring-slate-700'
									: 'bg-card border border-border focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40'
							}`}
						>
							{hasFiles && (
								<div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
									{images.map((img) => (
										<div
											key={img.id}
											className="relative group w-12 h-12 rounded-lg overflow-hidden bg-muted"
										>
											<img
												src={img.preview}
												alt="Attachment"
												className="w-full h-full object-cover"
											/>
											<button
												type="button"
												onClick={() => onFileRemove?.(img.id)}
												className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<X className="w-3 h-3 text-white" />
											</button>
										</div>
									))}
									{documents.map((doc) => (
										<div
											key={doc.id}
											className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-muted max-w-[200px]"
										>
											{doc.type === 'pdf' ? (
												<FileIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
											) : (
												<FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
											)}
											<span className="text-xs truncate">{doc.name}</span>
											<button
												type="button"
												onClick={() => onFileRemove?.(doc.id)}
												className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<X className="w-3 h-3 text-white" />
											</button>
										</div>
									))}
								</div>
							)}

							{researchContexts.length > 0 && (
								<div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
									{researchContexts.map((ctx) => (
										<div
											key={ctx.id}
											className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 max-w-[200px]"
										>
											<FlaskConical className="w-4 h-4 text-teal-500 flex-shrink-0" />
											<span className="text-xs truncate text-teal-600 dark:text-teal-400">
												{ctx.label}
											</span>
											{onResearchContextRemove && (
												<button
													type="button"
													onClick={() => onResearchContextRemove(ctx.id)}
													className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
												>
													<X className="w-3 h-3 text-white" />
												</button>
											)}
										</div>
									))}
								</div>
							)}

							<div className="flex items-end gap-1">
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
									onPaste={handleTextareaPaste}
									placeholder={
										isPlanMode
											? 'Plan mode - Type a message...'
											: 'Type a message...'
									}
									disabled={disabled}
									rows={1}
									className={`border-0 bg-transparent pl-1 pr-2 py-2 max-h-[200px] overflow-y-auto leading-normal resize-none scrollbar-hide text-base ${
										preferences.vimMode && vimMode === 'normal'
											? 'caret-[6px]'
											: ''
									}`}
									style={{ height: '2.5rem' }}
								/>
								<button
									type="button"
									onClick={handleSend}
									disabled={disabled || (!message.trim() && !hasFiles)}
									className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors flex-shrink-0 touch-manipulation ${
										message.trim() || hasFiles
											? 'bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground'
											: 'bg-transparent text-muted-foreground'
									}`}
								>
									<ArrowUp className="w-4 h-4" />
								</button>
							</div>
						</div>

						{(reasoningEnabled ||
							visionEnabled ||
							modelName ||
							providerName ||
							authType) && (
							<div className="grid grid-cols-[auto_1fr_auto] items-center mt-1 px-3">
								<div className="justify-self-start flex-shrink-0">
									{reasoningEnabled && (
										<span className="text-[10px] text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
											<Brain className="h-3 w-3" />
											thinking
										</span>
									)}
								</div>
								<div className="justify-self-center">
									{(providerName || modelName || authType) && (
										<div className="text-[10px] text-muted-foreground flex items-center gap-1 px-2 py-0.5">
											<button
												type="button"
												onClick={onModelInfoClick}
												className="flex items-center gap-1 transition-colors hover:text-foreground cursor-pointer"
											>
												{providerName && (
													<>
														<ProviderLogo
															provider={providerName}
															size={12}
															className="opacity-70"
														/>
														<span className="opacity-40">/</span>
													</>
												)}
												{modelName && <span>{modelName}</span>}
												{authType && authType === 'oauth' && (
													<span className="opacity-50">(pro)</span>
												)}
											</button>
											{isSetu && setuBalance !== null && (
												<>
													<span className="text-emerald-600 dark:text-emerald-400">
														${setuBalance.toFixed(2)}
													</span>
													{onRefreshBalance && (
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																onRefreshBalance();
															}}
															disabled={isBalanceLoading}
															className="p-0.5 hover:bg-background/50 rounded transition-colors disabled:opacity-50"
														>
															<RefreshCw
																className={`h-2.5 w-2.5 text-muted-foreground ${isBalanceLoading ? 'animate-spin' : ''}`}
															/>
														</button>
													)}
												</>
											)}
										</div>
									)}
								</div>
								<div className="justify-self-end flex-shrink-0">
									{visionEnabled && (
										<span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
											<ImageIcon className="h-3 w-3" />
											images
										</span>
									)}
								</div>
							</div>
						)}

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
								sessionId={sessionId}
							/>
						)}

						<ShortcutsModal
							isOpen={showShortcutsModal}
							onClose={() => setShowShortcutsModal(false)}
						/>
					</div>
				</div>
			</>
		);
	}),
);
