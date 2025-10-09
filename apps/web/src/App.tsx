import { useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { SessionListContainer } from './components/sessions/SessionListContainer';
import { MessageThreadContainer } from './components/messages/MessageThreadContainer';
import {
	ChatInputContainer,
	type ChatInputContainerRef,
} from './components/chat/ChatInputContainer';
import { useCreateSession } from './hooks/useSessions';
import { useTheme } from './hooks/useTheme';
import { useWorkingDirectory } from './hooks/useWorkingDirectory';
import { useSidebarStore } from './stores/sidebarStore';

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
	const chatInputRef = useRef<ChatInputContainerRef>(null);

	const createSession = useCreateSession();
	const { theme, toggleTheme } = useTheme();
	const setCollapsed = useSidebarStore((state) => state.setCollapsed);

	useWorkingDirectory();

	const handleNewSession = useCallback(async () => {
		try {
			const session = await createSession.mutateAsync({
				agent: 'general',
			});
			setActiveSessionId(session.id);
			// Close sidebar on mobile and focus input
			setCollapsed(true);
			setTimeout(() => {
				chatInputRef.current?.focus();
			}, 100);
		} catch (error) {
			console.error('Failed to create session:', error);
		}
	}, [createSession, setCollapsed]);

	const handleSelectSession = useCallback(
		(sessionId: string) => {
			setActiveSessionId(sessionId);
			// Close sidebar on mobile and focus input
			setCollapsed(true);
			setTimeout(() => {
				chatInputRef.current?.focus();
			}, 100);
		},
		[setCollapsed],
	);

	return (
		<AppLayout
			onNewSession={handleNewSession}
			theme={theme}
			onToggleTheme={toggleTheme}
			sidebar={
				<SessionListContainer
					activeSessionId={activeSessionId}
					onSelectSession={handleSelectSession}
				/>
			}
		>
			{activeSessionId ? (
				<>
					<MessageThreadContainer sessionId={activeSessionId} />
					<ChatInputContainer ref={chatInputRef} sessionId={activeSessionId} />
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
