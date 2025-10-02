import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { SessionList } from './components/sessions/SessionList';
import { MessageThread } from './components/messages/MessageThread';
import { ChatInput } from './components/chat/ChatInput';
import { useSessions, useCreateSession } from './hooks/useSessions';
import { useMessages, useSendMessage } from './hooks/useMessages';
import { useSessionStream } from './hooks/useSessionStream';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

function AppContent() {
	const [activeSessionId, setActiveSessionId] = useState<string>();

	const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
	const { data: messages = [], isLoading: messagesLoading } =
		useMessages(activeSessionId);
	const createSession = useCreateSession();
	const sendMessage = useSendMessage(activeSessionId || '');

	useSessionStream(activeSessionId);

	const handleNewSession = async () => {
		try {
			const session = await createSession.mutateAsync({
				agent: 'general',
			});
			setActiveSessionId(session.id);
		} catch (error) {
			console.error('Failed to create session:', error);
		}
	};

	const handleSendMessage = async (content: string) => {
		if (!activeSessionId) return;

		try {
			await sendMessage.mutateAsync({ content });
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	};

	if (sessionsLoading) {
		return (
			<div className="h-screen flex items-center justify-center bg-background text-muted-foreground">
				Loading sessions...
			</div>
		);
	}

	return (
		<AppLayout
			onNewSession={handleNewSession}
			sidebar={
				<SessionList
					sessions={sessions}
					activeSessionId={activeSessionId}
					onSelectSession={setActiveSessionId}
				/>
			}
		>
			{activeSessionId ? (
				<>
					{messagesLoading ? (
						<div className="flex-1 flex items-center justify-center text-muted-foreground">
							Loading messages...
						</div>
					) : (
						<MessageThread messages={messages} />
					)}
					<ChatInput
						onSend={handleSendMessage}
						disabled={sendMessage.isPending}
					/>
				</>
			) : (
				<div className="flex-1 flex items-center justify-center text-muted-foreground">
					Select a session or create a new one to start
				</div>
			)}
		</AppLayout>
	);
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AppContent />
		</QueryClientProvider>
	);
}

export default App;
