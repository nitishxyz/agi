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

export interface ChatInputViewProps {
	/** Callback when message is sent */
	onSend: (message: string) => void;
	/** Whether input is disabled */
	disabled?: boolean;
	/** Callback for config button click */
	onConfigClick?: () => void;
	/** Placeholder text */
	placeholder?: string;
	/** Custom className for container */
	className?: string;
	/** Custom className for input wrapper */
	inputClassName?: string;
	/** Whether to auto-focus on mount */
	autoFocus?: boolean;
	/** Maximum height for textarea */
	maxHeight?: string;
}

export interface ChatInputViewRef {
	focus: () => void;
	clear: () => void;
}

/**
 * ChatInputView - A flexible, size-agnostic chat input component
 *
 * This component uses relative positioning and can be placed anywhere in your layout.
 * It doesn't use absolute positioning or z-index, making it safe for use in sidebars,
 * modals, or any container.
 *
 * @example
 * ```tsx
 * // At the bottom of a flex container
 * <div className="flex flex-col h-screen">
 *   <MessageThreadView messages={messages} className="flex-1" />
 *   <ChatInputView onSend={handleSend} className="p-4" />
 * </div>
 *
 * // In a fixed-width sidebar
 * <div className="w-96 flex flex-col">
 *   <MessageThreadView messages={messages} className="flex-1" maxWidth="max-w-full" />
 *   <ChatInputView onSend={handleSend} className="p-4 border-t" />
 * </div>
 * ```
 */
export const ChatInputView = memo(
	forwardRef<ChatInputViewRef, ChatInputViewProps>(function ChatInputView(
		{
			onSend,
			disabled,
			onConfigClick,
			placeholder = 'Type a message...',
			className = '',
			inputClassName = '',
			autoFocus = true,
			maxHeight = 'max-h-[200px]',
		},
		ref,
	) {
		const [message, setMessage] = useState('');
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		useEffect(() => {
			if (autoFocus) {
				textareaRef.current?.focus();
			}
		}, [autoFocus]);

		useImperativeHandle(ref, () => ({
			focus: () => {
				textareaRef.current?.focus();
			},
			clear: () => {
				setMessage('');
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
			},
		}));

		// Auto-resize textarea based on content
		const adjustTextareaHeight = useCallback(() => {
			const textarea = textareaRef.current;
			if (textarea) {
				// Reset height to auto to get the correct scrollHeight
				textarea.style.height = 'auto';
				// Set height to scrollHeight (content height)
				textarea.style.height = `${textarea.scrollHeight}px`;
			}
		}, []);

		// biome-ignore lint/correctness/useExhaustiveDependencies: message dependency needed to trigger height adjustment
		useEffect(() => {
			adjustTextareaHeight();
		}, [adjustTextareaHeight, message]);

		const handleSend = useCallback(() => {
			if (message.trim() && !disabled) {
				onSend(message);
				setMessage('');
				// Reset textarea height after sending
				if (textareaRef.current) {
					textareaRef.current.style.height = 'auto';
				}
				textareaRef.current?.focus();
			}
		}, [message, disabled, onSend]);

		const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
			setMessage(e.target.value);
		}, []);

		const handleKeyDown = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					handleSend();
				}
			},
			[handleSend],
		);

		return (
			<div className={`w-full ${className}`}>
				<div className={`max-w-3xl mx-auto ${inputClassName}`}>
					<div className="flex items-end gap-1 bg-card rounded-3xl border border-border p-1 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-colors touch-manipulation">
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
							placeholder={placeholder}
							disabled={disabled}
							rows={1}
							className={`border-0 bg-transparent pl-1 pr-2 py-2 ${maxHeight} overflow-y-auto leading-normal resize-none scrollbar-hide text-base`}
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
				</div>
			</div>
		);
	}),
);
