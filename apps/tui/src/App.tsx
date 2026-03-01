import { useKeyboard, useRenderer } from '@opentui/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
	stageFiles,
	shareSession,
	syncShare,
	pushCommits,
} from '@ottocode/api';
import { StatusBar } from './components/StatusBar.tsx';
import { ChatView } from './components/ChatView.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { SessionsOverlay } from './components/SessionsOverlay.tsx';
import { ModelsOverlay } from './components/ModelsOverlay.tsx';
import { CommitOverlay } from './components/CommitOverlay.tsx';
import { HelpOverlay } from './components/HelpOverlay.tsx';
import { ThemeOverlay } from './components/ThemeOverlay.tsx';
import { MCPOverlay } from './components/MCPOverlay.tsx';
import { ApproveAllBar } from './components/ApproveAllBar.tsx';
import { useSession } from './hooks/useSession.ts';
import { useStream } from './hooks/useStream.ts';
import { useConfig } from './hooks/useConfig.ts';
import { parseCommand, resolveCommand } from './commands.ts';
import { useTheme } from './theme.ts';
import type { Overlay, Session } from './types.ts';

async function copyToClipboard(text: string): Promise<void> {
	const cmd =
		process.platform === 'darwin'
			? 'pbcopy'
			: process.platform === 'win32'
				? 'clip'
				: 'xclip -selection clipboard';
	const proc = Bun.spawn([
		'sh',
		'-c',
		`printf '%s' ${JSON.stringify(text)} | ${cmd}`,
	]);
	await proc.exited;
}

export type StatusIndicator =
	| { type: 'idle' }
	| { type: 'loading'; label: string }
	| { type: 'success'; label: string }
	| { type: 'error'; label: string };

export function App({ onQuit }: { onQuit: () => void }) {
	const renderer = useRenderer();
	const { colors, setTheme } = useTheme();
	const [overlay, setOverlay] = useState<Overlay>('none');
	const [status, setStatus] = useState<StatusIndicator>({ type: 'idle' });
	const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [escHint, setEscHint] = useState(false);
	const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showStatus = useCallback((s: StatusIndicator, autoClearMs?: number) => {
		if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
		setStatus(s);
		if (autoClearMs) {
			statusTimerRef.current = setTimeout(
				() => setStatus({ type: 'idle' }),
				autoClearMs,
			);
		}
	}, []);

	useEffect(
		() => () => {
			if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
			if (escTimerRef.current) clearTimeout(escTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		const handler = (selection: { getSelectedText: () => string }) => {
			const text = selection.getSelectedText();
			if (text) {
				copyToClipboard(text).then(() => {
					showStatus({ type: 'success', label: 'copied to clipboard' }, 2000);
				});
			}
		};
		renderer.on('selection', handler);
		return () => {
			renderer.off('selection', handler);
		};
	}, [renderer, showStatus]);

	const {
		sessions,
		activeSession,
		hasMore,
		loadingMore,
		loadSessions,
		loadMoreSessions,
		createSession,
		deleteSession,
		switchSession,
		updateSessionMeta,
		updateSessionPrefs,
		sendMessage,
		abortSession,
		approveToolCall,
	} = useSession();

	const { config, updateDefaults } = useConfig();

	const themeSyncedRef = useRef(false);
	useEffect(() => {
		if (!themeSyncedRef.current && config.defaults.theme) {
			setTheme(config.defaults.theme);
			themeSyncedRef.current = true;
		}
	}, [config.defaults.theme, setTheme]);

	const sessionId = activeSession?.id ?? null;
	const {
		messages,
		isStreaming,
		streamingMessageId,
		queueSize,
		queuedMessageIds,
		pendingApprovals,
		setPendingApprovals,
		reload,
		addOptimisticUser,
	} = useStream(sessionId, updateSessionMeta);

	const handleCommand = useCallback(
		async (name: string, args: string) => {
			const cmd = resolveCommand(name);
			switch (cmd) {
				case 'exit':
					onQuit();
					break;
				case 'sessions':
					await loadSessions();
					setOverlay('sessions');
					break;
				case 'new': {
					const session = await createSession(args || undefined);
					if (session) setOverlay('none');
					break;
				}
				case 'delete':
					if (activeSession) {
						await deleteSession(activeSession.id);
					}
					break;
			case 'mcp':
				setOverlay('mcp');
				break;
			case 'models':
				setOverlay('models');
				break;
			case 'commit':
					setOverlay('commit');
					break;
			case 'push':
				showStatus({ type: 'loading', label: 'pushing…' });
				try {
					// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
					const pushResponse = await pushCommits({ body: {} as any });
					if (pushResponse.error) {
						// biome-ignore lint/suspicious/noExplicitAny: SDK error type
						const err = pushResponse.error as any;
						showStatus({ type: 'error', label: err?.error || 'push failed' }, 3000);
					} else {
						// biome-ignore lint/suspicious/noExplicitAny: SDK response type
						const pushData = pushResponse.data as any;
						showStatus({ type: 'success', label: pushData?.data?.output || 'pushed' }, 3000);
					}
				} catch {
					showStatus({ type: 'error', label: 'push failed' }, 3000);
					}
					break;
				case 'stage':
					try {
						// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
						await stageFiles({ body: { files: ['.'] } as any });
						showStatus({ type: 'success', label: 'staged all' }, 3000);
					} catch {
						showStatus({ type: 'error', label: 'stage failed' }, 3000);
					}
					break;
				case 'help':
					setOverlay('help');
					break;
				case 'theme':
					setOverlay('theme');
					break;
				case 'clear':
					reload();
					break;
				case 'provider':
					if (args) {
						if (activeSession) {
							await updateSessionPrefs(activeSession.id, { provider: args });
						} else {
							const s = await createSession();
							if (s) await updateSessionPrefs(s.id, { provider: args });
						}
					}
					break;
				case 'compact':
					if (activeSession) {
						await sendMessage(activeSession.id, '/compact');
					}
					break;
				case 'stop':
					if (activeSession) {
						await abortSession(activeSession.id);
					}
					break;
				case 'reasoning':
					await updateDefaults({
						reasoningText: !(config.defaults.reasoningText ?? true),
					});
					break;
				case 'share':
					if (activeSession) {
						showStatus({ type: 'loading', label: 'sharing…' });
						try {
							const shareResponse = await shareSession({
								path: { sessionId: activeSession.id },
							});
							// biome-ignore lint/suspicious/noExplicitAny: SDK response structure
							const shareData = shareResponse.data as any;
							const shareUrl = shareData?.url;
							if (shareUrl) {
								await copyToClipboard(shareUrl);
								showStatus({ type: 'success', label: 'url copied' }, 3000);
							} else {
								showStatus({ type: 'error', label: 'share failed' }, 3000);
							}
						} catch {
							showStatus({ type: 'error', label: 'share failed' }, 3000);
						}
					}
					break;
				case 'sync':
					if (activeSession) {
						showStatus({ type: 'loading', label: 'syncing…' });
						try {
							const syncResponse = await syncShare({
								path: { sessionId: activeSession.id },
							});
							// biome-ignore lint/suspicious/noExplicitAny: SDK response structure
							const syncData = syncResponse.data as any;
							const syncUrl = syncData?.url;
							if (syncUrl) {
								await copyToClipboard(syncUrl);
								showStatus({ type: 'success', label: 'synced & copied' }, 3000);
							} else {
								showStatus({ type: 'error', label: 'sync failed' }, 3000);
							}
						} catch {
							showStatus({ type: 'error', label: 'sync failed' }, 3000);
						}
					}
					break;
			}
		},
		[
			activeSession,
			config,
			createSession,
			deleteSession,
			loadSessions,
			onQuit,
			reload,
			updateDefaults,
			sendMessage,
			abortSession,
			switchSession,
			showStatus,
		],
	);

	const handleSubmit = useCallback(
		async (text: string, images?: unknown[], files?: unknown[]) => {
			const cmd = parseCommand(text);
			if (cmd) {
				await handleCommand(cmd.name, cmd.args);
				return;
			}

			const attachmentNames = [
				...((images as { name?: string }[]) ?? [])
					.map((i) => i.name)
					.filter(Boolean),
				...((files as { name?: string }[]) ?? [])
					.map((f) => f.name)
					.filter(Boolean),
			] as string[];

			if (!activeSession) {
				const session = await createSession();
				if (session) {
					addOptimisticUser(
						text,
						attachmentNames.length > 0 ? attachmentNames : undefined,
					);
					await new Promise((r) => setTimeout(r, 150));
					await sendMessage(session.id, text, images, files);
				}
				return;
			}

			addOptimisticUser(
				text,
				attachmentNames.length > 0 ? attachmentNames : undefined,
			);
			await sendMessage(activeSession.id, text, images, files);
		},
		[
			activeSession,
			createSession,
			handleCommand,
			sendMessage,
			addOptimisticUser,
		],
	);

	const handleSessionSelect = useCallback(
		(session: Session) => {
			switchSession(session);
			setOverlay('none');
		},
		[switchSession],
	);

	const handleApprove = useCallback(
		async (callId: string) => {
			if (!activeSession) return;
			await approveToolCall(activeSession.id, callId, true);
			setPendingApprovals((prev) => prev.filter((a) => a.callId !== callId));
		},
		[activeSession, approveToolCall, setPendingApprovals],
	);

	const handleDeny = useCallback(
		async (callId: string) => {
			if (!activeSession) return;
			await approveToolCall(activeSession.id, callId, false);
			setPendingApprovals((prev) => prev.filter((a) => a.callId !== callId));
		},
		[activeSession, approveToolCall, setPendingApprovals],
	);

	const handleApproveAll = useCallback(async () => {
		if (!activeSession) return;
		await Promise.all(
			pendingApprovals.map((a) =>
				approveToolCall(activeSession.id, a.callId, true),
			),
		);
		setPendingApprovals([]);
	}, [activeSession, approveToolCall, pendingApprovals, setPendingApprovals]);

	useKeyboard((key) => {
		if (key.name === 'escape') {
			if (overlay !== 'none') {
				setOverlay('none');
				return;
			}
			if (isStreaming && activeSession) {
				if (escHint) {
					abortSession(activeSession.id);
					setEscHint(false);
					if (escTimerRef.current) clearTimeout(escTimerRef.current);
				} else {
					setEscHint(true);
					escTimerRef.current = setTimeout(() => setEscHint(false), 3000);
				}
				return;
			}
		}
		if (key.ctrl && key.name === 'n') {
			createSession();
			return;
		}
		if (key.ctrl && key.name === 's') {
			loadSessions().then(() => setOverlay('sessions'));
			return;
		}
		if (key.ctrl && key.name === 'p') {
			setOverlay('models');
			return;
		}
		if (key.ctrl && key.name === 't') {
			setOverlay('theme');
			return;
		}
		if (key.ctrl && key.name === 'm') {
			setOverlay('mcp');
			return;
		}
		if (key.ctrl && key.name === 'c') {
			if (isStreaming && activeSession) {
				abortSession(activeSession.id);
				setEscHint(false);
				if (escTimerRef.current) clearTimeout(escTimerRef.current);
			} else {
				onQuit();
			}
		}
	});

	useEffect(() => {
		if (!isStreaming) {
			setEscHint(false);
			if (escTimerRef.current) clearTimeout(escTimerRef.current);
		}
	}, [isStreaming]);

	const provider = activeSession?.provider || config.defaults.provider;
	const model = activeSession?.model || config.defaults.model;
	const currentAgent = activeSession?.agent || config.defaults.agent;

	const handlePlanModeToggle = useCallback(
		async (isPlanMode: boolean) => {
			const newAgent = isPlanMode ? 'plan' : 'build';
			if (activeSession) {
				await updateSessionPrefs(activeSession.id, { agent: newAgent });
			} else {
				const s = await createSession();
				if (s) await updateSessionPrefs(s.id, { agent: newAgent });
			}
		},
		[activeSession, updateSessionPrefs, createSession],
	);

	return (
		<box
			style={{
				width: '100%',
				height: '100%',
				flexDirection: 'column',
				backgroundColor: colors.bg,
				paddingBottom: 1,
			}}
		>
			<StatusBar
				sessionTitle={activeSession?.title ?? null}
				queueSize={queueSize}
			/>

			<ChatView
				messages={messages}
				isStreaming={isStreaming}
				streamingMessageId={streamingMessageId}
				queuedMessageIds={queuedMessageIds}
				pendingApprovals={pendingApprovals}
				onApprove={handleApprove}
				onDeny={handleDeny}
			/>

			{pendingApprovals.length > 0 && (
				<ApproveAllBar
					approvals={pendingApprovals}
					onApprove={handleApprove}
					onApproveAll={handleApproveAll}
					onDeny={handleDeny}
				/>
			)}

			<ChatInput
				onSubmit={handleSubmit}
				disabled={pendingApprovals.length > 0 || overlay !== 'none'}
				status={status}
				isStreaming={isStreaming}
				provider={provider}
				model={model}
				escHint={escHint}
				isPlanMode={currentAgent === 'plan'}
				onPlanModeToggle={handlePlanModeToggle}
			/>

			{overlay === 'sessions' && (
				<SessionsOverlay
					sessions={sessions}
					hasMore={hasMore}
					loadingMore={loadingMore}
					onLoadMore={loadMoreSessions}
					onSelect={handleSessionSelect}
					onClose={() => setOverlay('none')}
				/>
			)}

			{overlay === 'commit' && (
				<CommitOverlay
					onClose={() => setOverlay('none')}
					onCommitted={() =>
						showStatus({ type: 'success', label: 'committed' }, 3000)
					}
				/>
			)}

			{overlay === 'models' && (
				<ModelsOverlay
					currentProvider={provider}
					currentModel={model}
					onClose={() => setOverlay('none')}
					onSelect={(p, m) => {
						if (activeSession) {
							updateSessionPrefs(activeSession.id, { provider: p, model: m });
						} else {
							createSession().then((s) => {
								if (s) updateSessionPrefs(s.id, { provider: p, model: m });
							});
						}
						setOverlay('none');
					}}
				/>
			)}

		{overlay === 'help' && <HelpOverlay onClose={() => setOverlay('none')} />}
		{overlay === 'theme' && (
			<ThemeOverlay
				onClose={() => setOverlay('none')}
				onSave={(name: string) => updateDefaults({ theme: name })}
			/>
		)}
		{overlay === 'mcp' && (
			<MCPOverlay onClose={() => setOverlay('none')} />
		)}
	</box>
	);
}
