import { useKeyboard } from '@opentui/react';
import { useState, useCallback } from 'react';
import {
	stageFiles,
	generateCommitMessage,
	commitChanges,
	createBranch,
	shareSession,
	syncShare,
} from '@ottocode/api';
import { StatusBar } from './components/StatusBar.tsx';
import { ChatView } from './components/ChatView.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { SessionsOverlay } from './components/SessionsOverlay.tsx';
import { ConfigOverlay } from './components/ConfigOverlay.tsx';
import { HelpOverlay } from './components/HelpOverlay.tsx';
import { ApprovalOverlay } from './components/ApprovalOverlay.tsx';
import { useSession } from './hooks/useSession.ts';
import { useStream } from './hooks/useStream.ts';
import { useConfig } from './hooks/useConfig.ts';
import { parseCommand, resolveCommand } from './commands.ts';
import { colors } from './theme.ts';
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
		`echo -n ${JSON.stringify(text)} | ${cmd}`,
	]);
	await proc.exited;
}

export function App({ onQuit }: { onQuit: () => void }) {
	const [overlay, setOverlay] = useState<Overlay>('none');
	const [_reasoningEnabled, setReasoningEnabled] = useState(false);

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
		sendMessage,
		abortSession,
		approveToolCall,
	} = useSession();

	const { config, updateDefaults } = useConfig();

	const sessionId = activeSession?.id ?? null;
	const {
		messages,
		isStreaming,
		streamingMessageId,
		queueSize,
		queuedMessageIds,
		pendingApproval,
		setPendingApproval,
		reload,
		addOptimisticUser,
	} = useStream(sessionId);

	const handleCommand = useCallback(
		async (name: string, args: string) => {
			const cmd = resolveCommand(name);
			switch (cmd) {
				case 'quit':
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
				case 'config':
				case 'models':
				case 'agents':
					setOverlay('config');
					break;
				case 'help':
					setOverlay('help');
					break;
				case 'clear':
					reload();
					break;
				case 'model':
					if (args) await updateDefaults({ model: args });
					break;
				case 'provider':
					if (args) await updateDefaults({ provider: args });
					break;
				case 'agent':
					if (args) await updateDefaults({ agent: args });
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
					setReasoningEnabled((prev) => !prev);
					break;
				case 'stage':
					try {
						// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
						await stageFiles({ body: { files: ['.'] } as any });
					} catch {}
					break;
				case 'commit': {
					try {
						const genResponse = await generateCommitMessage({
							body: {},
						});
						// biome-ignore lint/suspicious/noExplicitAny: SDK response structure
						const genData = genResponse.data as any;
						const msg = genData?.data?.message || args || 'update';
						// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
						await commitChanges({ body: { message: msg } as any });
					} catch {}
					break;
				}
				case 'branch':
					if (activeSession) {
						try {
							const branchResponse = await createBranch({
								path: { sessionId: activeSession.id },
								// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
								body: {} as any,
							});
							const branched = branchResponse.data as unknown as Session;
							if (branched?.id) {
								await loadSessions();
								switchSession(branched);
							}
						} catch {}
					}
					break;
				case 'share':
					if (activeSession) {
						try {
							const shareResponse = await shareSession({
								path: { sessionId: activeSession.id },
							});
							// biome-ignore lint/suspicious/noExplicitAny: SDK response structure
							const shareData = shareResponse.data as any;
							const shareUrl = shareData?.url;
							if (shareUrl) await copyToClipboard(shareUrl);
						} catch {}
					}
					break;
				case 'sync':
					if (activeSession) {
						try {
							const syncResponse = await syncShare({
								path: { sessionId: activeSession.id },
							});
							// biome-ignore lint/suspicious/noExplicitAny: SDK response structure
							const syncData = syncResponse.data as any;
							const syncUrl = syncData?.url;
							if (syncUrl) await copyToClipboard(syncUrl);
						} catch {}
					}
					break;
			}
		},
		[
			activeSession,
			createSession,
			deleteSession,
			loadSessions,
			onQuit,
			reload,
			updateDefaults,
			sendMessage,
			abortSession,
			switchSession,
		],
	);

	const handleSubmit = useCallback(
		async (text: string) => {
			const cmd = parseCommand(text);
			if (cmd) {
				await handleCommand(cmd.name, cmd.args);
				return;
			}

			if (!activeSession) {
				const session = await createSession();
				if (session) {
					addOptimisticUser(text);
					await new Promise((r) => setTimeout(r, 150));
					await sendMessage(session.id, text);
				}
				return;
			}

			addOptimisticUser(text);
			await sendMessage(activeSession.id, text);
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
			setPendingApproval(null);
		},
		[activeSession, approveToolCall, setPendingApproval],
	);

	const handleDeny = useCallback(
		async (callId: string) => {
			if (!activeSession) return;
			await approveToolCall(activeSession.id, callId, false);
			setPendingApproval(null);
		},
		[activeSession, approveToolCall, setPendingApproval],
	);

	useKeyboard((key) => {
		if (key.name === 'escape') {
			if (overlay !== 'none') {
				setOverlay('none');
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
			setOverlay('config');
			return;
		}
		if (key.ctrl && key.name === 'c') {
			if (isStreaming && activeSession) {
				abortSession(activeSession.id);
			} else {
				onQuit();
			}
		}
	});

	const provider = activeSession?.provider || config.defaults.provider;
	const model = activeSession?.model || config.defaults.model;

	return (
		<box
			style={{
				width: '100%',
				height: '100%',
				flexDirection: 'column',
				backgroundColor: colors.bg,
			}}
		>
			<StatusBar
				provider={provider}
				model={model}
				sessionTitle={activeSession?.title ?? null}
				isStreaming={isStreaming}
				queueSize={queueSize}
			/>

			<ChatView
				messages={messages}
				isStreaming={isStreaming}
				streamingMessageId={streamingMessageId}
				queuedMessageIds={queuedMessageIds}
			/>

			<ChatInput onSubmit={handleSubmit} disabled={false} />

			<box
				style={{
					width: '100%',
					height: 1,
					flexShrink: 0,
					backgroundColor: colors.bgDark,
					flexDirection: 'row',
					paddingLeft: 1,
					paddingRight: 1,
					gap: 0,
				}}
			>
				<text fg={colors.fgDimmed}>
					^N new ^S sessions ^P config /help ^C {isStreaming ? 'abort' : 'quit'}
				</text>
			</box>

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

			{overlay === 'config' && (
				<ConfigOverlay
					providers={config.providers}
					agents={config.agents}
					currentProvider={provider}
					currentModel={model}
					currentAgent={activeSession?.agent || config.defaults.agent}
					onClose={() => setOverlay('none')}
					onUpdate={updateDefaults}
				/>
			)}

			{overlay === 'help' && <HelpOverlay onClose={() => setOverlay('none')} />}

			{pendingApproval && (
				<ApprovalOverlay
					approval={pendingApproval}
					onApprove={handleApprove}
					onDeny={handleDeny}
				/>
			)}
		</box>
	);
}
