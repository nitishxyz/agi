import { useKeyboard } from '@opentui/react';
import { useState, useCallback } from 'react';
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

export function App({ onQuit }: { onQuit: () => void }) {
	const [overlay, setOverlay] = useState<Overlay>('none');

	const {
		sessions,
		activeSession,
		loadSessions,
		createSession,
		deleteSession,
		switchSession,
		sendMessage,
		abortSession,
		approveToolCall,
	} = useSession();

	const { config, updateDefaults } = useConfig();

	const sessionId = activeSession?.id ?? null;
	const { messages, isStreaming, streamingMessageId, queueSize, pendingApproval, setPendingApproval, reload, addOptimisticUser } =
		useStream(sessionId);

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
		[activeSession, createSession, handleCommand, sendMessage, addOptimisticUser],
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

		<ChatView messages={messages} isStreaming={isStreaming} streamingMessageId={streamingMessageId} />

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
				<text fg={colors.fgDimmed}>^N new  ^S sessions  ^P config  /help  ^C {isStreaming ? 'abort' : 'quit'}</text>
			</box>

			{overlay === 'sessions' && (
				<SessionsOverlay
					sessions={sessions}
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
