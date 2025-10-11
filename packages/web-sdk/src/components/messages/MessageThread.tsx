import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Message, Session } from '../../types/api';
import { AssistantMessageGroup } from './AssistantMessageGroup';
import { UserMessageGroup } from './UserMessageGroup';
import { SessionHeader } from '../sessions/SessionHeader';
import { LeanHeader } from '../sessions/LeanHeader';

interface MessageThreadProps {
	messages: Message[];
	session?: Session;
	isGenerating?: boolean;
}

/**
 * MessageThread - Full-featured message thread component with session headers
 *
 * This component is designed for the AGI web app and uses absolute positioning
 * to fill its parent container. For a more flexible, size-agnostic component,
 * use MessageThreadView instead.
 *
 * @deprecated Use MessageThreadView for new projects
 */
export const MessageThread = memo(function MessageThread({
	messages,
	session,
	isGenerating,
}: MessageThreadProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const sessionHeaderRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const [showLeanHeader, setShowLeanHeader] = useState(false);
	const lastScrollHeightRef = useRef(0);
	const messagesLengthRef = useRef(0);

	// Detect if user has scrolled up manually
	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		// If user is within 100px of bottom, enable auto-scroll
		// Otherwise, they've scrolled up and we should stop auto-scrolling
		setAutoScroll(distanceFromBottom < 100);

		// Check if session header is scrolled off screen
		const headerElement = sessionHeaderRef.current;
		if (headerElement) {
			const headerRect = headerElement.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			// Show lean header when session header has scrolled above the container's top
			setShowLeanHeader(headerRect.bottom < containerRect.top);
		}
	};

	// Re-enable auto-scroll when messages length changes (new message added)
	useEffect(() => {
		if (messages.length > messagesLengthRef.current) {
			setAutoScroll(true);
		}
		messagesLengthRef.current = messages.length;
	}, [messages.length]);

	// Auto-scroll when messages change AND user hasn't scrolled up
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages dependency is required for streaming content updates
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || !autoScroll) return;

		// Use requestAnimationFrame to ensure the DOM has updated
		requestAnimationFrame(() => {
			if (!bottomRef.current || !container) return;

			const { scrollHeight } = container;
			const isNewContent = scrollHeight !== lastScrollHeightRef.current;

			// Use instant scroll during rapid updates, smooth for new messages
			const behavior = isNewContent ? 'smooth' : 'instant';

			bottomRef.current.scrollIntoView({
				behavior: behavior as ScrollBehavior,
			});
			lastScrollHeightRef.current = scrollHeight;
		});
	}, [messages, autoScroll]);

	const scrollToBottom = () => {
		setAutoScroll(true);
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	// Memoize filtered messages to avoid recalculating on every render
	const filteredMessages = useMemo(() => {
		return messages.filter((message) => message.role !== 'system');
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
				No messages yet. Start a conversation below.
			</div>
		);
	}

	return (
		<div className="absolute inset-0 flex flex-col">
			{/* Lean Header - shows when session header scrolls off - positioned within thread */}
			{session && (
				<LeanHeader
					session={session}
					isVisible={showLeanHeader}
					isGenerating={isGenerating}
				/>
			)}

			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto"
				onScroll={handleScroll}
			>
				{/* Session Header - scrolls with content */}
				<div ref={sessionHeaderRef}>
					{session && <SessionHeader session={session} />}
				</div>

				{/* Messages */}
				<div className="p-6 pb-32">
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
});
