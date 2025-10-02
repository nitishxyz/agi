import { useEffect, useRef } from 'react';
import type { Message } from '../../types/api';
import { AssistantMessageGroup } from './AssistantMessageGroup';
import { UserMessageGroup } from './UserMessageGroup';

interface MessageThreadProps {
	messages: Message[];
}

export function MessageThread({ messages }: MessageThreadProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to scroll when messages change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length]);

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				No messages yet. Start a conversation below.
			</div>
		);
	}

	const filteredMessages = messages.filter(
		(message) => message.role !== 'system',
	);

	return (
		<div className="flex-1 overflow-y-auto p-6 pb-32">
			<div className="max-w-3xl mx-auto space-y-6">
				{filteredMessages.map((message, idx) => {
					const prevMessage = filteredMessages[idx - 1];
					const nextMessage = filteredMessages[idx + 1];
					const isLastMessage = idx === filteredMessages.length - 1;

					if (message.role === 'user') {
						return (
							<UserMessageGroup
								key={message.id}
								message={message}
								isFirst={idx === 0}
							/>
						);
					}

					if (message.role === 'assistant') {
						const showHeader = !prevMessage || prevMessage.role !== 'assistant';
						const nextIsAssistant =
							nextMessage && nextMessage.role === 'assistant';

						return (
							<AssistantMessageGroup
								key={message.id}
								message={message}
								showHeader={showHeader}
								hasNextAssistantMessage={nextIsAssistant}
								isLastMessage={isLastMessage}
							/>
						);
					}

					return null;
				})}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
