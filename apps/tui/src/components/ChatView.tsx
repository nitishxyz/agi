import { useMemo } from 'react';
import { MessageItem } from './MessageItem.tsx';
import { colors } from '../theme.ts';
import type { Message } from '../types.ts';

interface ChatViewProps {
	messages: Message[];
	isStreaming: boolean;
	streamingMessageId: string | null;
	queuedMessageIds: Set<string>;
}

export function ChatView({ messages, isStreaming, streamingMessageId, queuedMessageIds }: ChatViewProps) {
	const sorted = useMemo(() => {
		return messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.sort((a, b) => a.createdAt - b.createdAt);
	}, [messages]);

	const queuedUserIds = useMemo(() => {
		const ids = new Set<string>();
		for (let i = 0; i < sorted.length; i++) {
			const msg = sorted[i];
			if (msg.role === 'user') {
				const next = sorted[i + 1];
				if (next && next.role === 'assistant' && queuedMessageIds.has(next.id)) {
					ids.add(msg.id);
				}
			}
		}
		return ids;
	}, [sorted, queuedMessageIds]);

	const visibleMessages = useMemo(() => {
		return sorted.filter((m) => {
			if (
				m.role === 'assistant' &&
				m.status === 'pending' &&
				(!m.parts || m.parts.length === 0) &&
				m.id !== streamingMessageId
			) {
				return false;
			}
			return true;
		});
	}, [sorted, streamingMessageId]);

	if (visibleMessages.length === 0) {
		return (
			<box
				style={{
					width: '100%',
					flexGrow: 1,
					justifyContent: 'center',
					alignItems: 'center',
					flexDirection: 'column',
					gap: 1,
				}}
			>
				<text fg={colors.blue}>
					<b>otto</b>
				</text>
				<text fg={colors.fgDark}>Type a message below to start a conversation</text>
				<text fg={colors.fgDimmed}>or type /help for commands</text>
			</box>
		);
	}

	return (
		<scrollbox
			style={{
				width: '100%',
				flexGrow: 1,
				paddingLeft: 0,
				paddingRight: 0,
				paddingTop: 1,
				paddingBottom: 0,
			}}
			stickyScroll
			stickyStart="bottom"
		>
			{visibleMessages.map((msg, i) => (
				<MessageItem
					key={msg.id}
					message={msg}
					isStreaming={msg.id === streamingMessageId}
					isQueued={queuedUserIds.has(msg.id)}
					isFirstMessage={i === 0}
				/>
			))}
		</scrollbox>
	);
}
