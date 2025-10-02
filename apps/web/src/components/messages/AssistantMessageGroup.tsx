import { Sparkles } from 'lucide-react';
import type { Message } from '../../types/api';
import { MessagePartItem } from './MessagePartItem';

interface AssistantMessageGroupProps {
	message: Message;
	showHeader: boolean;
	hasNextAssistantMessage: boolean;
	isLastMessage: boolean;
}

const loadingMessages = [
	'Generating...',
	'Cooking up something...',
	'Thinking...',
	'Processing...',
	'Working on it...',
	'Crafting response...',
	'Brewing magic...',
	'Computing...',
];

function getLoadingMessage(messageId: string) {
	// Use messageId to consistently pick the same message for this session
	const hash = messageId
		.split('')
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return loadingMessages[hash % loadingMessages.length];
}

export function AssistantMessageGroup({
	message,
	showHeader,
	hasNextAssistantMessage,
}: AssistantMessageGroupProps) {
	const parts = message.parts || [];
	const formatTime = (ts?: number) => {
		if (!ts) return '';
		const date = new Date(ts);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className="relative">
			{/* Header with avatar */}
			{showHeader && (
				<div className="pb-2">
					<div className="inline-flex items-center bg-violet-500/5 border border-violet-500/20 rounded-full pr-4">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/50 bg-violet-500/10">
							<Sparkles className="h-3.5 w-3.5 text-violet-400" />
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground pl-3">
							{message.agent && (
								<span className="font-medium text-violet-400">
									{message.agent}
								</span>
							)}
							{message.agent && message.provider && <span>·</span>}
							{message.provider && <span>{message.provider}</span>}
							{message.model && <span>·</span>}
							{message.model && <span>{message.model}</span>}
							{message.createdAt && <span>·</span>}
							{message.createdAt && (
								<span>{formatTime(message.createdAt)}</span>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Message parts with timeline */}
			<div className="relative ml-1">
				{parts.map((part, index) => {
					const isLastPart = index === parts.length - 1;
					const showLine = !isLastPart || hasNextAssistantMessage;
					const isLastToolCall = part.type === 'tool_call' && isLastPart;

					// Check if this is the last progress_update (before finish)
					const isLastProgressUpdate =
						part.type === 'tool_result' &&
						part.toolName === 'progress_update' &&
						isLastPart &&
						!parts.some((p) => p.toolName === 'finish');

					return (
						<MessagePartItem
							key={part.id}
							part={part}
							showLine={showLine}
							isFirstPart={index === 0 && !showHeader}
							isLastToolCall={isLastToolCall}
							isLastProgressUpdate={isLastProgressUpdate}
						/>
					);
				})}

				{/* Show loading state if message is incomplete and no progress/finish */}
				{message.status === 'pending' &&
					!parts.some((p) => p.toolName === 'progress_update') &&
					!parts.some((p) => p.toolName === 'finish') &&
					parts.length > 0 && (
						<div className="flex gap-3 pb-2 relative">
							<div className="flex-shrink-0 w-6 flex items-start justify-center relative pt-0.5">
								<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full relative z-10 bg-background">
									<Sparkles className="h-4 w-4 text-violet-400" />
								</div>
							</div>
							<div className="flex-1 pt-0.5">
								<div className="text-base text-foreground/70 animate-pulse">
									{getLoadingMessage(message.id)}
								</div>
							</div>
						</div>
					)}
			</div>
		</div>
	);
}
