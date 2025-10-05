import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { SessionListContainer } from './components/sessions/SessionListContainer';
import { MessageThreadContainer } from './components/messages/MessageThreadContainer';
import { ChatInputContainer } from './components/chat/ChatInputContainer';
import { useCreateSession } from './hooks/useSessions';
import { useTheme } from './hooks/useTheme';
import { useWorkingDirectory } from './hooks/useWorkingDirectory';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			structuralSharing: true,
		},
	},
});

function AppContent() {
	const [activeSessionId, setActiveSessionId] = useState<string>();

	const createSession = useCreateSession();
	const { theme, toggleTheme } = useTheme();

	useWorkingDirectory();

	const handleNewSession = useCallback(async () => {
		try {
			const session = await createSession.mutateAsync({
				agent: 'general',
			});
			setActiveSessionId(session.id);
		} catch (error) {
			console.error('Failed to create session:', error);
		}
	}, [createSession]);

	return (
		<AppLayout
			onNewSession={handleNewSession}
			theme={theme}
			onToggleTheme={toggleTheme}
			sidebar={
				<SessionListContainer
					activeSessionId={activeSessionId}
					onSelectSession={setActiveSessionId}
				/>
			}
		>
			{activeSessionId ? (
				<>
					<MessageThreadContainer sessionId={activeSessionId} />
					<ChatInputContainer sessionId={activeSessionId} />
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
