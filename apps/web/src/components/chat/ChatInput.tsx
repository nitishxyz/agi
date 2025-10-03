import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp, MoreVertical } from 'lucide-react';
import { Input } from '../ui/Input';

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	onConfigClick?: () => void;
}

export function ChatInput({ onSend, disabled, onConfigClick }: ChatInputProps) {
	const [message, setMessage] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSend = () => {
		if (message.trim() && !disabled) {
			onSend(message);
			setMessage('');
			inputRef.current?.focus();
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="absolute bottom-0 left-0 right-0 pt-16 pb-8 px-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-50">
			<div className="max-w-3xl mx-auto pointer-events-auto">
			<div className="flex items-center gap-1 bg-card rounded-full border border-border p-1 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-colors">
					{onConfigClick && (
						<button
							type="button"
							onClick={onConfigClick}
							className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-background/50 transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
						>
							<MoreVertical className="w-4 h-4" />
						</button>
					)}
					<Input
						ref={inputRef}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						disabled={disabled}
						className="border-0 bg-transparent pl-1 pr-2"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={disabled || !message.trim()}
						className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors flex-shrink-0 ${
							message.trim()
								? 'bg-primary hover:bg-primary/90 text-primary-foreground'
								: 'bg-transparent text-muted-foreground'
						}`}
					>
						<ArrowUp className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
