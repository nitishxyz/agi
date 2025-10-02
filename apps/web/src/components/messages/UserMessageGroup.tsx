import { User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../types/api';

interface UserMessageGroupProps {
	message: Message;
	isFirst: boolean;
}

export function UserMessageGroup({ message }: UserMessageGroupProps) {
	const parts = message.parts || [];
	const firstPart = parts[0];

	if (!firstPart) return null;

	let content = '';
	const data = firstPart.contentJson || firstPart.content;
	if (data && typeof data === 'object' && 'text' in data) {
		content = String(data.text);
	} else if (typeof data === 'string') {
		content = data;
	} else if (data) {
		content = JSON.stringify(data, null, 2);
	}

	const formatTime = (ts?: number) => {
		if (!ts) return '';
		const date = new Date(ts);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className="relative pb-8 pt-6">
			<div className="flex gap-4">
				<div className="flex-shrink-0 w-8 flex items-start justify-center">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/10 relative z-10 bg-background">
						<User className="h-4 w-4 text-emerald-400" />
					</div>
				</div>
				<div className="flex-1">
					<div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
						<span className="font-medium text-emerald-400">You</span>
						{message.createdAt && <span>·</span>}
						{message.createdAt && <span>{formatTime(message.createdAt)}</span>}
					</div>
					<div className="text-sm text-foreground/90 leading-relaxed prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
						<ReactMarkdown>{content}</ReactMarkdown>
					</div>
				</div>
			</div>
		</div>
	);
}
