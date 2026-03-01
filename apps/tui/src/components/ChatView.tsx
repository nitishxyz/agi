import { useMemo } from 'react';
import { MessageItem } from './MessageItem.tsx';
import { colors } from '../theme.ts';
import type { Message } from '../types.ts';

interface ChatViewProps {
	messages: Message[];
	isStreaming: boolean;
}

export function ChatView({ messages, isStreaming }: ChatViewProps) {
	const visibleMessages = useMemo(() => {
		return messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.sort((a, b) => a.createdAt - b.createdAt);
	}, [messages]);

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
			{visibleMessages.map((msg, i) => {
				const isLast =
					i === visibleMessages.length - 1 && msg.role === 'assistant';
				return (
					<MessageItem
						key={msg.id}
						message={msg}
						isStreaming={isStreaming && isLast}
						isFirstMessage={i === 0}
					/>
				);
			})}
		</scrollbox>
	);
}
