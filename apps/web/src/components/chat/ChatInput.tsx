import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
	const [message, setMessage] = useState('');

	const handleSend = () => {
		if (message.trim() && !disabled) {
			onSend(message);
			setMessage('');
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="absolute bottom-0 left-0 right-0 pt-16 pb-8 px-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
			<div className="max-w-3xl mx-auto pointer-events-auto">
				<div className="flex gap-2 bg-muted rounded-full border border-border p-1">
					<Input
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						disabled={disabled}
						className="border-0 bg-transparent focus:ring-0 px-4"
					/>
					<Button
						onClick={handleSend}
						disabled={disabled || !message.trim()}
						className="rounded-full"
					>
						<Send className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
