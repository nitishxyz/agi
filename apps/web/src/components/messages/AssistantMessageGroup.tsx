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

					return (
						<MessagePartItem
							key={part.id}
							part={part}
							showLine={showLine}
							isFirstPart={index === 0 && !showHeader}
							isLastToolCall={isLastToolCall}
						/>
					);
				})}
			</div>
		</div>
	);
}
