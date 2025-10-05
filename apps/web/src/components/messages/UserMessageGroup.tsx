import { memo } from 'react';
import { User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types/api';

interface UserMessageGroupProps {
	message: Message;
	isFirst: boolean;
}

// Memoize the component to prevent re-renders when props haven't changed
export const UserMessageGroup = memo(
	function UserMessageGroup({ message }: UserMessageGroupProps) {
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
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			});
		};

		return (
			<div className="relative pb-8 pt-6">
				<div className="flex gap-4 justify-end">
					<div className="flex flex-col items-end max-w-2xl">
						<div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 justify-end">
							<span className="font-medium text-emerald-700 dark:text-emerald-300">
								You
							</span>
							{message.createdAt && <span>·</span>}
							{message.createdAt && (
								<span>{formatTime(message.createdAt)}</span>
							)}
						</div>
						<div className="text-sm text-foreground leading-relaxed prose prose-invert prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 max-w-full break-words overflow-wrap-anywhere">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{content}
							</ReactMarkdown>
						</div>
					</div>
					<div className="flex-shrink-0 w-8 flex items-start justify-center">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 dark:bg-emerald-500/10 relative z-10 bg-background">
							<User className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
						</div>
					</div>
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison function for better memoization
		// User messages don't change after creation, so we only need to check the message ID
		const prevFirstPart = prevProps.message.parts?.[0];
		const nextFirstPart = nextProps.message.parts?.[0];

		return (
			prevProps.message.id === nextProps.message.id &&
			prevFirstPart?.content === nextFirstPart?.content &&
			prevFirstPart?.contentJson === nextFirstPart?.contentJson &&
			prevProps.message.createdAt === nextProps.message.createdAt
		);
	},
);
