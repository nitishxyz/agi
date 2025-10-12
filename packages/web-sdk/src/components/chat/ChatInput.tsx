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

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	onConfigClick?: () => void;
	onPlanModeToggle?: (isPlanMode: boolean) => void;
	isPlanMode?: boolean;
}

export const ChatInput = memo(
	forwardRef<{ focus: () => void }, ChatInputProps>(function ChatInput(
		{ onSend, disabled, onConfigClick, onPlanModeToggle, isPlanMode: externalIsPlanMode },
		ref,
	) {
		const [message, setMessage] = useState('');
		const [isPlanMode, setIsPlanMode] = useState(externalIsPlanMode || false);
		const textareaRef = useRef<HTMLTextAreaElement>(null);

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

		const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
			setMessage(e.target.value);
		}, []);

		const handleKeyDown = useCallback(
			(e: KeyboardEvent<HTMLTextAreaElement>) => {
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
			[handleSend, isPlanMode, onPlanModeToggle],
		);

		return (
			<div className="absolute bottom-0 left-0 right-0 pt-16 pb-6 md:pb-8 px-2 md:px-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-20 safe-area-inset-bottom">
				<div className="max-w-3xl mx-auto pointer-events-auto mb-2 md:mb-0">
					<div
						className={`flex items-end gap-1 rounded-3xl p-1 transition-all touch-manipulation ${
							isPlanMode
								? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 focus-within:border-blue-300 dark:focus-within:border-blue-700 focus-within:ring-1 focus-within:ring-blue-200 dark:focus-within:ring-blue-800'
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
				</div>
			</div>
		);
	}),
);
