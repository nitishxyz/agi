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
	useConfig,
	useTheme,
	useWorkingDirectory,
	useKeyboardShortcuts,
} from '@agi-cli/web-sdk/hooks';
import { useSidebarStore, useGitStore } from '@agi-cli/web-sdk/stores';
import {
	useGitStatus,
	useStageFiles,
	useUnstageFiles,
	useRestoreFiles,
	useSessions,
} from '@agi-cli/web-sdk/hooks';

interface SessionsLayoutProps {
	sessionId?: string;
}

export function SessionsLayout({ sessionId }: SessionsLayoutProps) {
	const chatInputRef = useRef<ChatInputContainerRef>(null);
	const createSession = useCreateSession();
	const { data: config } = useConfig();
	const { theme, toggleTheme } = useTheme();
	const setCollapsed = useSidebarStore((state) => state.setCollapsed);
	const { openCommitModal, openDiff } = useGitStore();
	const navigate = useNavigate();
	const { data: sessions = [] } = useSessions();
	const { data: gitStatus } = useGitStatus();
	const stageFiles = useStageFiles();
	const unstageFiles = useUnstageFiles();
	const restoreFiles = useRestoreFiles();

	useWorkingDirectory();

	const focusInput = useCallback(() => {
		setTimeout(() => {
			chatInputRef.current?.focus();
		}, 100);
	}, []);

	const handleNewSession = useCallback(async () => {
		try {
			const session = await createSession.mutateAsync({
				agent: config?.defaults.agent || 'general',
				provider: config?.defaults.provider,
				model: config?.defaults.model,
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
	}, [createSession, config, navigate, setCollapsed, focusInput]);

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

	const gitFiles = useMemo(() => {
		if (!gitStatus) return [];
		return [
			...gitStatus.staged.map((f) => ({ path: f.path, staged: true })),
			...gitStatus.unstaged.map((f) => ({ path: f.path, staged: false })),
			...gitStatus.untracked.map((f) => ({ path: f.path, staged: false })),
		];
	}, [gitStatus]);

	const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);

	useKeyboardShortcuts({
		sessionIds,
		activeSessionId: sessionId,
		gitFiles,
		onSelectSession: handleSelectSession,
		onNewSession: handleNewSession,
		onStageFile: (path) => stageFiles.mutate([path]),
		onUnstageFile: (path) => unstageFiles.mutate([path]),
		onRestoreFile: (path) => restoreFiles.mutate([path]),
		onStageAll: () => {
			const unstaged = gitFiles.filter((f) => !f.staged).map((f) => f.path);
			if (unstaged.length > 0) stageFiles.mutate(unstaged);
		},
		onUnstageAll: () => {
			const staged = gitFiles.filter((f) => f.staged).map((f) => f.path);
			if (staged.length > 0) unstageFiles.mutate(staged);
		},
		onOpenCommitModal: openCommitModal,
		onViewDiff: openDiff,
		onReturnToInput: focusInput,
	});

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
				<ChatInputContainer ref={chatInputRef} sessionId={sessionId} />
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
