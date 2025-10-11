import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppLayout } from '../layout/AppLayout';
import {
	SessionListContainer,
	MessageThreadContainer,
	ChatInputContainer,
	type ChatInputContainerRef,
} from '@agi-cli/web-sdk/components';
import {
	useCreateSession,
	useTheme,
	useWorkingDirectory,
} from '@agi-cli/web-sdk/hooks';
import { useSidebarStore } from '@agi-cli/web-sdk/stores';

interface SessionsLayoutProps {
	sessionId?: string;
}

export function SessionsLayout({ sessionId }: SessionsLayoutProps) {
	const chatInputRef = useRef<ChatInputContainerRef>(null);
	const createSession = useCreateSession();
	const { theme, toggleTheme } = useTheme();
	const setCollapsed = useSidebarStore((state) => state.setCollapsed);
	const navigate = useNavigate();

	useWorkingDirectory();

	const focusInput = useCallback(() => {
		setTimeout(() => {
			chatInputRef.current?.focus();
		}, 100);
	}, []);

	const handleNewSession = useCallback(async () => {
		try {
			const session = await createSession.mutateAsync({
				agent: 'general',
			});
			navigate({
				to: '/sessions/$sessionId',
				params: { sessionId: session.id },
				replace: false,
			});
			setCollapsed(true);
			focusInput();
		} catch (error) {
			console.error('Failed to create session:', error);
		}
	}, [createSession, navigate, setCollapsed, focusInput]);

	const handleSelectSession = useCallback(
		(id: string) => {
			navigate({
				to: '/sessions/$sessionId',
				params: { sessionId: id },
			});
			setCollapsed(true);
			focusInput();
		},
		[navigate, setCollapsed, focusInput],
	);

	useEffect(() => {
		if (sessionId) {
			focusInput();
		}
	}, [sessionId, focusInput]);

	const mainContent = useMemo(() => {
		if (!sessionId) {
			return (
				<div className="flex-1 flex items-center justify-center text-muted-foreground">
					Select a session or create a new one to start
				</div>
			);
		}

		return (
			<>
				<MessageThreadContainer sessionId={sessionId} />
				<ChatInputContainer
					ref={chatInputRef}
					sessionId={sessionId}
					userContext="Nitish is a seasoned developer who crated multiple opensource projects like agi and solforge"
				/>
			</>
		);
	}, [sessionId]);

	return (
		<AppLayout
			onNewSession={handleNewSession}
			theme={theme}
			onToggleTheme={toggleTheme}
			sidebar={
				<SessionListContainer
					activeSessionId={sessionId}
					onSelectSession={handleSelectSession}
				/>
			}
		>
			{mainContent}
		</AppLayout>
	);
}
