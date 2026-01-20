import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import type { Message } from '../../types/api';
import { MessagePartItem } from './MessagePartItem';
import { useMessageQueuePosition } from '../../hooks/useQueueState';

interface AssistantMessageGroupProps {
	sessionId?: string;
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
	const hash = messageId
		.split('')
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return loadingMessages[hash % loadingMessages.length];
}

export const AssistantMessageGroup = memo(
	function AssistantMessageGroup({
		sessionId,
		message,
		showHeader,
		hasNextAssistantMessage,
	}: AssistantMessageGroupProps) {
		const { isQueued } = useMessageQueuePosition(sessionId, message.id);
		const parts = message.parts || [];
		const hasFinish = parts.some((part) => part.toolName === 'finish');
		const latestProgressUpdateIndex = parts.reduce(
			(lastIndex, part, index) =>
				part.type === 'tool_result' && part.toolName === 'progress_update'
					? index
					: lastIndex,
			-1,
		);
		const latestProgressUpdatePart =
			latestProgressUpdateIndex >= 0 ? parts[latestProgressUpdateIndex] : null;
		const hasVisibleNonProgressParts = parts.some(
			(part) =>
				!(part.type === 'tool_result' && part.toolName === 'progress_update'),
		);
		const firstVisiblePartIndex = parts.findIndex(
			(part) =>
				!(part.type === 'tool_result' && part.toolName === 'progress_update'),
		);
		const shouldShowProgressUpdate =
			message.status === 'pending' &&
			!hasFinish &&
			Boolean(latestProgressUpdatePart);
		const shouldShowLoadingFallback =
			message.status === 'pending' &&
			!hasFinish &&
			!latestProgressUpdatePart &&
			!isQueued;
		const formatTime = (ts?: number) => {
			if (!ts) return '';
			const date = new Date(ts);
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			});
		};

		if (isQueued) {
			return null;
		}

		return (
			<div className="relative">
				{showHeader && (
					<div className="pb-2">
						<div className="inline-flex items-center bg-violet-500/10 border border-violet-500/30 dark:bg-violet-500/5 dark:border-violet-500/20 rounded-full pr-3 md:pr-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/50 bg-violet-500/20 dark:bg-violet-500/10">
								<Sparkles className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" />
							</div>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm text-muted-foreground pl-3">
								{message.agent && (
									<span className="font-medium text-violet-700 dark:text-violet-300 whitespace-nowrap">
										{message.agent}
									</span>
								)}
								{message.agent && message.provider && (
									<span className="hidden md:inline">·</span>
								)}
								{message.provider && (
									<span className="text-muted-foreground whitespace-nowrap">
										{message.provider}
									</span>
								)}
								{message.model && <span className="hidden md:inline">·</span>}
								{message.model && (
									<span className="text-muted-foreground break-all md:break-normal">
										{message.model}
									</span>
								)}
								{message.createdAt && (
									<span className="hidden md:inline">·</span>
								)}
								{message.createdAt && (
									<span className="text-muted-foreground whitespace-nowrap">
										{formatTime(message.createdAt)}
									</span>
								)}
							</div>
						</div>
					</div>
				)}

				<div className="relative ml-1">
					{parts.map((part, index) => {
						const isLastPart = index === parts.length - 1;
						const isFinishTool =
							part.type === 'tool_result' && part.toolName === 'finish';
						const showLine =
							(!isLastPart || hasNextAssistantMessage) && !isFinishTool;
						const isLastToolCall = part.type === 'tool_call' && isLastPart;
						const isProgressUpdate =
							part.type === 'tool_result' &&
							part.toolName === 'progress_update';

						if (isProgressUpdate) {
							return null;
						}

						return (
							<MessagePartItem
								key={part.id}
								part={part}
								showLine={showLine}
								isFirstPart={index === firstVisiblePartIndex && !showHeader}
								isLastToolCall={isLastToolCall}
							/>
						);
					})}

					{shouldShowProgressUpdate && latestProgressUpdatePart && (
						<MessagePartItem
							key={latestProgressUpdatePart.id}
							part={latestProgressUpdatePart}
							showLine={hasNextAssistantMessage}
							isFirstPart={!hasVisibleNonProgressParts && !showHeader}
							isLastProgressUpdate
						/>
					)}

					{shouldShowLoadingFallback && (
						<div className="flex gap-3 pb-2 relative">
							<div className="flex-shrink-0 w-6 flex items-start justify-center relative pt-0.5">
								<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full relative bg-card text-violet-700 dark:bg-background dark:text-violet-300">
									<Sparkles className="h-4 w-4" />
								</div>
							</div>
							<div className="flex-1 pt-0.5">
								<div className="text-base text-foreground animate-pulse">
									{getLoadingMessage(message.id)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		const prevParts = prevProps.message.parts || [];
		const nextParts = nextProps.message.parts || [];

		if (prevParts.length !== nextParts.length) {
			return false;
		}

		for (let i = 0; i < prevParts.length; i++) {
			const prevPart = prevParts[i];
			const nextPart = nextParts[i];
			if (
				prevPart.id !== nextPart.id ||
				prevPart.content !== nextPart.content ||
				prevPart.contentJson !== nextPart.contentJson ||
				prevPart.ephemeral !== nextPart.ephemeral ||
				prevPart.completedAt !== nextPart.completedAt
			) {
				return false;
			}
		}

		return (
			prevProps.message.id === nextProps.message.id &&
			prevProps.message.status === nextProps.message.status &&
			prevProps.message.completedAt === nextProps.message.completedAt &&
			prevProps.showHeader === nextProps.showHeader &&
			prevProps.hasNextAssistantMessage === nextProps.hasNextAssistantMessage &&
			prevProps.isLastMessage === nextProps.isLastMessage &&
			prevProps.sessionId === nextProps.sessionId
		);
	},
);
