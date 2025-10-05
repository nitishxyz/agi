import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { SessionList } from './components/sessions/SessionList';
import { MessageThread } from './components/messages/MessageThread';
import { ChatInput } from './components/chat/ChatInput';
import { ConfigModal } from './components/chat/ConfigModal';
import { useSessions, useCreateSession } from './hooks/useSessions';
import { useMessages, useSendMessage } from './hooks/useMessages';
import { useSessionStream } from './hooks/useSessionStream';
import { useTheme } from './hooks/useTheme';
import { useWorkingDirectory } from './hooks/useWorkingDirectory';

// Configure QueryClient with structural sharing enabled for better performance
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Enable structural sharing (default is true, but being explicit)
			// This ensures that unchanged data retains the same object references
			structuralSharing: true,
		},
	},
});

function AppContent() {
	const [activeSessionId, setActiveSessionId] = useState<string>();
	const [agent, setAgent] = useState('');
	const [provider, setProvider] = useState('');
	const [model, setModel] = useState('');
	const [isConfigOpen, setIsConfigOpen] = useState(false);
	const [inputKey, setInputKey] = useState(0);

	const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
	const { data: messages = [], isLoading: messagesLoading } =
		useMessages(activeSessionId);
	const createSession = useCreateSession();
	const sendMessage = useSendMessage(activeSessionId || '');
	const { theme, toggleTheme } = useTheme();

	// Set page title to current working directory
	useWorkingDirectory();

	useSessionStream(activeSessionId);

	useEffect(() => {
		setInputKey((prev) => prev + 1);
	}, [activeSessionId]);

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
			await sendMessage.mutateAsync({
				content,
				agent: agent || undefined,
				provider: provider || undefined,
				model: model || undefined,
			});
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	};

	// Get the active session object
	const activeSession = sessions.find((s) => s.id === activeSessionId);

	// Check if there's an assistant message that's pending (being generated)
	const isGenerating = messages.some(
		(m) => m.role === 'assistant' && m.status === 'pending',
	);

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
			theme={theme}
			onToggleTheme={toggleTheme}
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
						<MessageThread 
							messages={messages} 
							session={activeSession} 
							isGenerating={isGenerating}
						/>
					)}
					<ConfigModal
						isOpen={isConfigOpen}
						onClose={() => setIsConfigOpen(false)}
						agent={agent}
						provider={provider}
						model={model}
						onAgentChange={setAgent}
						onProviderChange={setProvider}
						onModelChange={setModel}
					/>
					<ChatInput
						key={inputKey}
						onSend={handleSendMessage}
						disabled={sendMessage.isPending}
						onConfigClick={() => setIsConfigOpen(true)}
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
