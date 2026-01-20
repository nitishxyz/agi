import { memo, useMemo } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useSessionStream } from '../../hooks/useSessionStream';
import { useSessions } from '../../hooks/useSessions';
import { MessageThread } from './MessageThread';

interface MessageThreadContainerProps {
	sessionId: string;
}

export const MessageThreadContainer = memo(function MessageThreadContainer({
	sessionId,
}: MessageThreadContainerProps) {
	const { data: messages = [], isLoading } = useMessages(sessionId);
	const { data: sessions = [] } = useSessions();

	useSessionStream(sessionId);

	const session = useMemo(
		() => sessions.find((s) => s.id === sessionId),
		[sessions, sessionId],
	);

	const isGenerating = useMemo(
		() =>
			messages.some((m) => m.role === 'assistant' && m.status === 'pending'),
		[messages],
	);

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				Loading messages...
			</div>
		);
	}

	return (
		<MessageThread
			messages={messages}
			sessionId={sessionId}
			session={session}
			isGenerating={isGenerating}
		/>
	);
});
