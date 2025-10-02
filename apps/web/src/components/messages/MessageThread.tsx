import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Message } from '../../types/api';
import { AssistantMessageGroup } from './AssistantMessageGroup';
import { UserMessageGroup } from './UserMessageGroup';

interface MessageThreadProps {
	messages: Message[];
}

export function MessageThread({ messages }: MessageThreadProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const lastScrollHeightRef = useRef(0);

	// Detect if user has scrolled up manually
	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		// If user is within 100px of bottom, enable auto-scroll
		// Otherwise, they've scrolled up and we should stop auto-scrolling
		setAutoScroll(distanceFromBottom < 100);
	};

	// Auto-scroll when messages change AND user hasn't scrolled up
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || !autoScroll) return;

		// Use instant scroll during rapid updates, smooth for new messages
		const behavior =
			lastScrollHeightRef.current === container.scrollHeight
				? 'instant'
				: 'smooth';

		bottomRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior });
		lastScrollHeightRef.current = container.scrollHeight;
	}, [messages, autoScroll]);

	// Force scroll on new message (length change)
	useEffect(() => {
		// Re-enable auto-scroll when a new message arrives
		setAutoScroll(true);
	}, [messages.length]);

	const scrollToBottom = () => {
		setAutoScroll(true);
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

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
		<div className="absolute inset-0 flex flex-col">
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto p-6 pb-32"
				onScroll={handleScroll}
			>
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
							const showHeader =
								!prevMessage || prevMessage.role !== 'assistant';
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

			{/* Scroll to bottom button - only shown when user has scrolled up */}
			{!autoScroll && (
				<button
					type="button"
					onClick={scrollToBottom}
					className="absolute bottom-36 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-full shadow-lg hover:bg-muted/50 transition-all text-sm text-foreground z-10"
				>
					<ArrowDown className="w-4 h-4" />
					<span>Scroll to bottom</span>
				</button>
			)}
		</div>
	);
}
