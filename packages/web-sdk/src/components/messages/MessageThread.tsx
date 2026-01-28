import { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Message, Session } from '../../types/api';
import { AssistantMessageGroup } from './AssistantMessageGroup';
import { UserMessageGroup } from './UserMessageGroup';
import { SessionHeader } from '../sessions/SessionHeader';
import { LeanHeader } from '../sessions/LeanHeader';
import { TopupApprovalCard } from './TopupApprovalCard';
import { useTopupApprovalStore } from '../../stores/topupApprovalStore';
import { apiClient } from '../../lib/api-client';
import { toast } from '../../stores/toastStore';

interface MessageThreadProps {
	messages: Message[];
	session?: Session;
	sessionId?: string;
	isGenerating?: boolean;
	disableAutoScroll?: boolean;
	onSelectSession?: (sessionId: string) => void;
}

export const MessageThread = memo(function MessageThread({
	messages,
	session,
	sessionId,
	isGenerating,
	disableAutoScroll = false,
	onSelectSession,
}: MessageThreadProps) {
	const queryClient = useQueryClient();
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const sessionHeaderRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const autoScrollRef = useRef(true);
	const [showLeanHeader, setShowLeanHeader] = useState(false);
	const userScrollingRef = useRef(false);
	const userScrollTimeoutRef = useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const targetScrollRef = useRef(0);
	const animationFrameRef = useRef<number | undefined>(undefined);
	const initialScrollDoneRef = useRef(false);
	const lastSessionIdRef = useRef<string | undefined>(session?.id);
	const prevMessagesLengthRef = useRef(messages.length);
	const prevIsGeneratingRef = useRef(isGenerating);
	const lastScrollHeightRef = useRef(0);
	const lastScrollTopRef = useRef(0);

	const pendingTopup = useTopupApprovalStore((s) => s.pendingTopup);
	const clearPendingTopup = useTopupApprovalStore((s) => s.clearPendingTopup);

	const showTopupApproval =
		pendingTopup && pendingTopup.sessionId === sessionId;

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		const scrollHeightIncreased = scrollHeight > lastScrollHeightRef.current;
		const userScrolledUp = scrollTop < lastScrollTopRef.current - 5;

		lastScrollHeightRef.current = scrollHeight;
		lastScrollTopRef.current = scrollTop;

		if (distanceFromBottom < 100) {
			autoScrollRef.current = true;
			setAutoScroll(true);
		} else if (userScrolledUp) {
			autoScrollRef.current = false;
			setAutoScroll(false);
			userScrollingRef.current = true;
		} else if (!scrollHeightIncreased && autoScrollRef.current) {
			autoScrollRef.current = false;
			setAutoScroll(false);
		}
		if (
			userScrolledUp ||
			(!autoScrollRef.current && distanceFromBottom >= 100)
		) {
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

	// Immediate scroll to bottom on initial load or session change
	useEffect(() => {
		if (disableAutoScroll) return;

		const sessionChanged = session?.id !== lastSessionIdRef.current;
		lastSessionIdRef.current = session?.id;

		if (sessionChanged) {
			initialScrollDoneRef.current = false;
		}

		if (!initialScrollDoneRef.current && messages.length > 0) {
			initialScrollDoneRef.current = true;
			const container = scrollContainerRef.current;
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
		}
	}, [messages.length, session?.id, disableAutoScroll]);

	useEffect(() => {
		if (disableAutoScroll) return;

		const justStartedGenerating = isGenerating && !prevIsGeneratingRef.current;
		const messagesAdded = messages.length > prevMessagesLengthRef.current;

		prevIsGeneratingRef.current = isGenerating;
		prevMessagesLengthRef.current = messages.length;

		// Scroll to bottom when generation starts (user just sent a message)
		if (justStartedGenerating) {
			userScrollingRef.current = false;
			autoScrollRef.current = true;
			setAutoScroll(true);
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const container = scrollContainerRef.current;
					if (container) {
						container.scrollTop = container.scrollHeight;
					}
				});
			});
		} else if (messagesAdded && !userScrollingRef.current && !isGenerating) {
			autoScrollRef.current = true;
			setAutoScroll(true);
		}
	}, [messages.length, isGenerating, disableAutoScroll]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: messages dep needed for streaming content updates
	useEffect(() => {
		if (disableAutoScroll) return;

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
				el.scrollTop = el.scrollHeight - el.clientHeight;
				return;
			}

			// If very close, just snap to bottom
			if (Math.abs(diff) < 10) {
				el.scrollTop = el.scrollHeight - el.clientHeight;
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
		autoScrollRef.current = true;
		setAutoScroll(true);
		const container = scrollContainerRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	};

	// Memoize filtered messages to avoid recalculating on every render
	const filteredMessages = useMemo(() => {
		return messages.filter((message) => message.role !== 'system');
	}, [messages]);

	// Create a retry handler for error messages
	const createRetryHandler = useCallback(
		(messageId: string) => {
			return async () => {
				if (!sessionId) return;
				if (!messageId) return;
				
				// Optimistically update the message to pending state and clear parts
				queryClient.setQueryData<Message[]>(
					['messages', sessionId],
					(oldMessages) => {
						if (!oldMessages) return oldMessages;
						return oldMessages.map((msg) =>
							msg.id === messageId
								? { ...msg, status: 'pending', parts: [], error: null }
								: msg,
						);
					},
				);
				
				try {
					await apiClient.retryMessage(sessionId, messageId);
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : 'Failed to retry',
					);
			}
		};
	},
	[sessionId, queryClient],
);

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
					onNavigateToSession={onSelectSession}
				/>
			)}

			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto"
				onScroll={handleScroll}
			>
				{/* Session Header - scrolls with content */}
				<div ref={sessionHeaderRef}>
					{session && (
						<SessionHeader
							session={session}
							onNavigateToSession={onSelectSession}
						/>
					)}
				</div>

				{/* Messages */}
				<div className="p-6 pb-64">
					<div className="max-w-3xl mx-auto space-y-6">
						{filteredMessages.map((message, idx) => {
							const prevMessage = filteredMessages[idx - 1];
							const nextMessage = filteredMessages[idx + 1];
							const isLastMessage = idx === filteredMessages.length - 1;

							if (message.role === 'user') {
								const nextAssistantMessage =
									nextMessage && nextMessage.role === 'assistant'
										? nextMessage
										: undefined;
								return (
									<UserMessageGroup
										key={message.id}
										sessionId={sessionId}
										message={message}
										isFirst={idx === 0}
										nextAssistantMessageId={nextAssistantMessage?.id}
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
										sessionId={sessionId}
										message={message}
										showHeader={showHeader}
							hasNextAssistantMessage={nextIsAssistant}
							isLastMessage={isLastMessage}
							onBranchCreated={onSelectSession}
							onRetry={createRetryHandler(message.id)}
						/>
					);
				}

						return null;
					})}

					{/* Topup Approval Card - shown when payment required */}
					{showTopupApproval && pendingTopup && (
						<div className="py-4">
							<TopupApprovalCard
								pendingTopup={pendingTopup}
								onMethodSelected={() => clearPendingTopup()}
								onCancel={() => clearPendingTopup()}
							/>
						</div>
					)}

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
