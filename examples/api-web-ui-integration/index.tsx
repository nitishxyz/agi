/**
 * Example: Building a custom otto chat UI
 *
 * This example demonstrates:
 * - Using @ottocode/api for type-safe API calls
 * - Using @ottocode/web-ui components for UI
 * - Using @ottocode/web-ui hooks for state management
 * - Real-time SSE streaming
 */

import { useState, useEffect } from 'react';
import { createApiClient } from '@ottocode/api';
import {
	Button,
	Card,
	ChatInput,
	SessionListContainer,
	SessionHeader,
} from '@ottocode/web-ui/components';
import {
	useSessions,
	useMessages,
	useSessionStream,
} from '@ottocode/web-ui/hooks';
import type { Message, MessagePart } from '@ottocode/web-ui/types';

const API_BASE_URL = 'http://localhost:9100';

// Main Chat App Component
export function ChatApp() {
	const { sessions, loading, error } = useSessions(API_BASE_URL);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

	// Auto-select first session
	useEffect(() => {
		if (sessions.length > 0 && !currentSessionId) {
			setCurrentSessionId(sessions[0].id);
		}
	}, [sessions, currentSessionId]);

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-lg">Loading sessions...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Card className="max-w-md p-8">
					<h2 className="mb-4 text-xl font-bold text-red-600">Error</h2>
					<p>{error.message}</p>
					<p className="mt-4 text-sm text-gray-500">
						Make sure the otto server is running on {API_BASE_URL}
					</p>
				</Card>
			</div>
		);
	}

	const currentSession = sessions.find((s) => s.id === currentSessionId);

	return (
		<div className="flex h-screen">
			{/* Sessions Sidebar */}
			<aside className="w-80 border-r border-gray-200 p-4 dark:border-gray-700">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">Sessions</h2>
					<NewSessionButton />
				</div>

				<SessionListContainer
					sessions={sessions}
					activeSessionId={currentSessionId || undefined}
					onSessionSelect={setCurrentSessionId}
				/>
			</aside>

			{/* Main Chat Area */}
			<main className="flex flex-1 flex-col">
				{currentSession ? (
					<>
						<SessionHeader session={currentSession} />
						<ChatArea sessionId={currentSession.id} />
					</>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<p className="text-gray-500">Select a session to get started</p>
					</div>
				)}
			</main>
		</div>
	);
}

// New Session Button
function NewSessionButton() {
	const [creating, setCreating] = useState(false);

	const handleCreateSession = async () => {
		setCreating(true);
		try {
			const api = createApiClient({ baseUrl: API_BASE_URL });
			await api.sessions.create({
				agent: 'code',
				provider: 'anthropic',
				model: 'claude-3-5-sonnet-20241022',
			});
			// Sessions will auto-reload via useSessions hook
		} catch (error) {
			console.error('Failed to create session:', error);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Button
			size="sm"
			variant="primary"
			onClick={handleCreateSession}
			disabled={creating}
		>
			{creating ? 'Creating...' : '+ New'}
		</Button>
	);
}

// Chat Area with Messages and Input
function ChatArea({ sessionId }: { sessionId: string }) {
	const { messages, loading } = useMessages(sessionId, API_BASE_URL);
	const { events, connected } = useSessionStream(sessionId, API_BASE_URL);
	const [sending, setSending] = useState(false);

	const handleSendMessage = async (content: string) => {
		setSending(true);
		try {
			const api = createApiClient({ baseUrl: API_BASE_URL });
			await api.messages.create(sessionId, { content });
		} catch (error) {
			console.error('Failed to send message:', error);
		} finally {
			setSending(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<p className="text-gray-500">Loading messages...</p>
			</div>
		);
	}

	return (
		<>
			{/* Connection Status */}
			<div className="border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
				<span
					className={`inline-flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}
				>
					<span className="h-2 w-2 rounded-full bg-current" />
					{connected ? 'Connected' : 'Disconnected'}
				</span>
				{events.length > 0 && (
					<span className="ml-4 text-gray-500">
						{events.length} events received
					</span>
				)}
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-auto p-4">
				<div className="space-y-4">
					{messages.map((message) => (
						<MessageBubble key={message.id} message={message} />
					))}
				</div>
			</div>

			{/* Input */}
			<div className="border-t border-gray-200 p-4 dark:border-gray-700">
				<ChatInput
					onSubmit={handleSendMessage}
					disabled={sending || !connected}
					placeholder={
						connected ? 'Type your message...' : 'Waiting for connection...'
					}
				/>
			</div>
		</>
	);
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === 'user';

	return (
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
			<Card
				className={`max-w-2xl ${
					isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
				}`}
			>
				<div className="mb-1 text-xs font-semibold uppercase opacity-70">
					{message.role}
				</div>
				{message.parts?.map((part: MessagePart) => (
					<div
						key={`${part.messageId}-${part.index}`}
						className="whitespace-pre-wrap"
					>
						{part.type === 'text' ? JSON.parse(part.content).text : ''}
					</div>
				))}
				<div className="mt-2 text-xs opacity-50">
					{new Date(message.createdAt).toLocaleTimeString()}
				</div>
			</Card>
		</div>
	);
}

// Example usage with server
if (import.meta.main) {
	console.log(`
╭─────────────────────────────────────────────╮
│  ottocode - Custom Chat UI Example          │
│                                             │
│  This example demonstrates how to build a   │
│  custom chat UI using @ottocode/api and      │
│  @ottocode/web-ui packages.                  │
│                                             │
│  Components used:                           │
│  ✓ @ottocode/api - Type-safe API client     │
│  ✓ @ottocode/web-ui/components              │
│  ✓ @ottocode/web-ui/hooks                   │
│                                             │
│  To run this example:                       │
│  1. Start the otto server (port 9100)       │
│  2. Run: bun run dev                        │
│  3. Open: http://localhost:3001             │
╰─────────────────────────────────────────────╯
	`);

	// Note: You would typically use a bundler like Vite to run this React app
	// For demonstration purposes only - see the README for proper setup
}
