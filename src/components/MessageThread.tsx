import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Message } from './Message';
import { SessionHeader } from './SessionHeader';
import { LeadHeader } from './LeadHeader';
import type { Message as MessageType } from '../types/message';
import type { Session } from '../types/session';

interface MessageThreadProps {
	messages: MessageType[];
	session: Session | null;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
	messages,
	session,
}) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const sessionHeaderRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [showLeadHeader, setShowLeadHeader] = useState(false);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handleScroll = () => {
			const headerElement = sessionHeaderRef.current;
			if (!headerElement) return;

			const headerRect = headerElement.getBoundingClientRect();
			// Show lead header when session header has scrolled off screen
			setShowLeadHeader(headerRect.bottom < 0);
		};

		container.addEventListener('scroll', handleScroll);
		return () => container.removeEventListener('scroll', handleScroll);
	}, [session]);

	if (!session) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				Select a session to view messages
			</div>
		);
	}

	return (
		<>
			<LeadHeader session={session} isVisible={showLeadHeader} />
			<div ref={containerRef} className="flex-1 overflow-y-auto">
				<div ref={sessionHeaderRef}>
					<SessionHeader session={session} />
				</div>

				<div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
					{messages.map((message) => (
						<Message key={message.id} message={message} />
					))}
					<div ref={messagesEndRef} />
				</div>
			</div>
		</>
	);
};
