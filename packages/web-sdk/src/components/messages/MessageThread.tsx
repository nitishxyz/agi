import { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
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
	const userScrollingRef = useRef(false);
	const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const targetScrollRef = useRef(0);
	const animationFrameRef = useRef<number>();
	const prevMessagesLengthRef = useRef(messages.length);

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		if (distanceFromBottom < 100) {
			setAutoScroll(true);
		} else {
			setAutoScroll(false);
			userScrollingRef.current = true;
			if (userScrollTimeoutRef.current) {
				clearTimeout(userScrollTimeoutRef.current);
			}
			userScrollTimeoutRef.current = setTimeout(() => {
				userScrollingRef.current = false;
			}, 150);
		}

		const headerElement = sessionHeaderRef.current;
		if (headerElement) {
			const headerRect = headerElement.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			setShowLeanHeader(headerRect.bottom < containerRect.top);
		}
	}, []);

	useEffect(() => {
		if (
			messages.length > prevMessagesLengthRef.current &&
			!userScrollingRef.current
		) {
			if (!isGenerating) {
				setAutoScroll(true);
			}
		}
		prevMessagesLengthRef.current = messages.length;
	}, [messages.length, isGenerating]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: messages dep needed for streaming content updates
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || !autoScroll || userScrollingRef.current) return;

		targetScrollRef.current = container.scrollHeight - container.clientHeight;

		const animate = () => {
			const el = scrollContainerRef.current;
			if (!el || userScrollingRef.current) return;

			const current = el.scrollTop;
			const target = el.scrollHeight - el.clientHeight;
			const diff = target - current;

			if (Math.abs(diff) < 1) {
				el.scrollTop = target;
				return;
			}

			el.scrollTop = current + diff * 0.15;
			animationFrameRef.current = requestAnimationFrame(animate);
		};

		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}
		animationFrameRef.current = requestAnimationFrame(animate);
	}, [messages, autoScroll]);

	useEffect(() => {
		return () => {
			if (userScrollTimeoutRef.current) {
				clearTimeout(userScrollTimeoutRef.current);
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	const scrollToBottom = () => {
		userScrollingRef.current = false;
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
