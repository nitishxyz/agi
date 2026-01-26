import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppLayout } from '../layout/AppLayout';
import {
	SessionListContainer,
	MessageThreadContainer,
	ChatInputContainer,
	type ChatInputContainerRef,
	Toaster,
} from '@agi-cli/web-sdk/components';
import {
	useCreateSession,
	useConfig,
	useTheme,
	useWorkingDirectory,
	useKeyboardShortcuts,
} from '@agi-cli/web-sdk/hooks';
import { useGitStore, useConfirmationStore } from '@agi-cli/web-sdk/stores';
import {
	useGitStatus,
	useStageFiles,
	useSolforgePayments,
	useUnstageFiles,
	useRestoreFiles,
	useDeleteFiles,
	useSessions,
	useSolforgeBalance,
} from '@agi-cli/web-sdk/hooks';

interface SessionsLayoutProps {
	sessionId?: string;
}

export function SessionsLayout({ sessionId }: SessionsLayoutProps) {
	const chatInputRef = useRef<ChatInputContainerRef>(null);
	const createSession = useCreateSession();
	const { data: config } = useConfig();
	const { theme, toggleTheme } = useTheme();
	const { openCommitModal, openDiff } = useGitStore();
	const navigate = useNavigate();
	const { data: sessions = [] } = useSessions();
	const { data: gitStatus } = useGitStatus();
	const stageFiles = useStageFiles();
	const unstageFiles = useUnstageFiles();
	const restoreFiles = useRestoreFiles();
	const deleteFiles = useDeleteFiles();
	const openConfirmation = useConfirmationStore(
		(state) => state.openConfirmation,
	);

	useWorkingDirectory();
	useSolforgePayments(sessionId);
	useSolforgeBalance(config?.defaults?.provider);

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
			focusInput();
		} catch (error) {
			console.error('Failed to create session:', error);
		}
	}, [createSession, config, navigate, focusInput]);

	const handleDeleteSession = useCallback(() => {
		navigate({ to: '/sessions' });
	}, [navigate]);

	const handleSelectSession = useCallback(
		(id: string) => {
			navigate({
				to: '/sessions/$sessionId',
				params: { sessionId: id },
			});
			focusInput();
		},
		[navigate, focusInput],
	);

	const gitFiles = useMemo(() => {
		if (!gitStatus) return [];
		return [
			...gitStatus.staged.map((f) => ({
				path: f.path,
				staged: true,
				status: f.status,
			})),
			...gitStatus.unstaged.map((f) => ({
				path: f.path,
				staged: false,
				status: f.status,
			})),
			...gitStatus.untracked.map((f) => ({
				path: f.path,
				staged: false,
				status: f.status,
			})),
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
		onDeleteFile: (path) => {
			openConfirmation({
				title: 'Delete File',
				message: `Delete ${path}? This will permanently remove the untracked file.`,
				confirmLabel: 'Delete',
				variant: 'destructive',
				onConfirm: async () => {
					await deleteFiles.mutateAsync([path]);
				},
			});
		},
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
				<MessageThreadContainer
					sessionId={sessionId}
					onSelectSession={handleSelectSession}
				/>
			<ChatInputContainer
				ref={chatInputRef}
				sessionId={sessionId}
				onNewSession={handleNewSession}
				onDeleteSession={handleDeleteSession}
			/>
		</>
	);
}, [sessionId, handleNewSession, handleSelectSession, handleDeleteSession]);

	return (
		<>
			<AppLayout
				onNewSession={handleNewSession}
				theme={theme}
				onToggleTheme={toggleTheme}
				sessionId={sessionId}
				onNavigateToSession={handleSelectSession}
				sidebar={
					<SessionListContainer
						activeSessionId={sessionId}
						onSelectSession={handleSelectSession}
					/>
				}
			>
				{mainContent}
			</AppLayout>
			<Toaster />
		</>
	);
}
