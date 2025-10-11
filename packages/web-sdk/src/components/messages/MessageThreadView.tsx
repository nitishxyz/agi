import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Message, Session } from '../../types/api';
import { AssistantMessageGroup } from './AssistantMessageGroup';
import { UserMessageGroup } from './UserMessageGroup';

export interface MessageThreadViewProps {
	/** Array of messages to display */
	messages?: Message[];
	/** Optional session for header display */
	session?: Session;
	/** Whether the assistant is currently generating */
	isGenerating?: boolean;
	/** Custom header component (replaces default SessionHeader) */
	header?: React.ReactNode;
	/** Whether to show the lean header on scroll */
	showLeanHeader?: boolean;
	/** Custom lean header component */
	leanHeader?: React.ReactNode;
	/** Custom empty state component */
	emptyState?: React.ReactNode;
	/** Custom class name for the container */
	className?: string;
	/** Custom class name for messages wrapper */
	messagesClassName?: string;
	/** Maximum width for message content (default: 'max-w-3xl') */
	maxWidth?: string;
	/** Whether to auto-scroll to bottom on new messages (default: true) */
	autoScroll?: boolean;
}

/**
 * MessageThreadView - A size-agnostic, self-contained message thread component
 *
 * This component uses relative positioning and fills its parent container.
 * Use this when you want full control over the layout.
 *
 * @example
 * ```tsx
 * // In a flex container
 * <div className="flex flex-col h-screen">
 *   <MessageThreadView messages={messages} className="flex-1" />
 *   <ChatInput onSend={handleSend} />
 * </div>
 *
 * // In a fixed-height container
 * <div className="h-[600px]">
 *   <MessageThreadView messages={messages} className="h-full" />
 * </div>
 *
 * // In a sidebar with custom width
 * <div className="w-96">
 *   <MessageThreadView messages={messages} className="h-full" maxWidth="max-w-full" />
 * </div>
 * ```
 */
export const MessageThreadView = memo(function MessageThreadView({
	messages: messagesProp,
	session: _session,
	isGenerating: _isGenerating,
	header,
	showLeanHeader: showLeanHeaderProp,
	leanHeader,
	emptyState,
	className = '',
	messagesClassName = '',
	maxWidth = 'max-w-3xl',
	autoScroll: autoScrollProp = true,
}: MessageThreadViewProps) {
	// Ensure messages is always an array
	const messages = messagesProp || [];

	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(autoScrollProp);
	const [showLeanHeaderState, setShowLeanHeaderState] = useState(false);
	const lastScrollHeightRef = useRef(0);
	const messagesLengthRef = useRef(0);

	const showLeanHeaderComputed =
		showLeanHeaderProp !== undefined ? showLeanHeaderProp : showLeanHeaderState;

	// Detect if user has scrolled up manually
	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		// If user is within 100px of bottom, enable auto-scroll
		setAutoScroll(distanceFromBottom < 100);

		// Check if header is scrolled off screen
		if (header && headerRef.current) {
			const headerElement = headerRef.current;
			const headerRect = headerElement.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			setShowLeanHeaderState(headerRect.bottom < containerRect.top);
		}
	};

	// Re-enable auto-scroll when messages length changes
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

		requestAnimationFrame(() => {
			if (!bottomRef.current || !container) return;

			const { scrollHeight } = container;
			const isNewContent = scrollHeight !== lastScrollHeightRef.current;

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

	// Memoize filtered messages
	const filteredMessages = useMemo(() => {
		return messages.filter((message) => message.role !== 'system');
	}, [messages]);

	// Default empty state
	const defaultEmptyState = (
		<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6">
			No messages yet. Start a conversation below.
		</div>
	);

	if (messages.length === 0) {
		return (
			<div className={`flex flex-col ${className}`}>
				{emptyState || defaultEmptyState}
			</div>
		);
	}

	return (
		<div className={`relative flex flex-col ${className}`}>
			{/* Lean Header - shows when main header scrolls off */}
			{leanHeader && showLeanHeaderComputed && (
				<div className="sticky top-0 z-30">{leanHeader}</div>
			)}

			{/* Scrollable content */}
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto overflow-x-hidden"
				onScroll={handleScroll}
			>
				{/* Main Header */}
				{header && <div ref={headerRef}>{header}</div>}

				{/* Messages */}
				<div className={`p-6 pb-32 ${messagesClassName}`}>
					<div className={`${maxWidth} mx-auto space-y-6 w-full`}>
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

			{/* Scroll to bottom button */}
			{!autoScroll && (
				<button
					type="button"
					onClick={scrollToBottom}
					className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-full shadow-lg hover:bg-muted/50 transition-all text-sm text-foreground z-10"
				>
					<ArrowDown className="w-4 h-4" />
					<span>Scroll to bottom</span>
				</button>
			)}
		</div>
	);
});
