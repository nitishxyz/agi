import { Sparkles } from 'lucide-react';
import type { Message } from '../../types/api';
import { MessagePartItem } from './MessagePartItem';

interface AssistantMessageGroupProps {
	message: Message;
	showHeader: boolean;
	hasNextAssistantMessage: boolean;
	isLastMessage: boolean;
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
				<div className="flex gap-4 pb-2">
					<div className="flex-shrink-0 w-8 flex items-center justify-center pt-1">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-500/50 bg-violet-500/10 relative z-10 bg-background">
							<Sparkles className="h-4 w-4 text-violet-400" />
						</div>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
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
						{message.createdAt && <span>{formatTime(message.createdAt)}</span>}
					</div>
				</div>
			)}

			{/* Message parts with timeline */}
			<div className="relative">
				{parts.map((part, index) => {
					// Check if this tool call has a result
					const hasResult =
						part.type === 'tool_call' &&
						parts.some(
							(p, idx) =>
								idx > index &&
								p.type === 'tool_result' &&
								p.toolCallId === part.toolCallId,
						);

					const isLastPart = index === parts.length - 1;
					const showLine = !isLastPart || hasNextAssistantMessage;

					return (
						<MessagePartItem
							key={part.id}
							part={part}
							showLine={showLine}
							isFirstPart={index === 0 && !showHeader}
							hasResult={hasResult}
						/>
					);
				})}
			</div>
		</div>
	);
}
