import { useMemo } from 'react';
import { colors, syntaxStyle } from '../theme.ts';
import { ToolCallItem } from './ToolCallItem.tsx';
import type { Message, MessagePart } from '../types.ts';

interface MessageItemProps {
	message: Message;
	isStreaming: boolean;
	isFirstMessage: boolean;
}

function extractText(part: MessagePart): string {
	if (
		part.contentJson &&
		typeof part.contentJson === 'object' &&
		!Array.isArray(part.contentJson) &&
		'text' in part.contentJson
	) {
		return String(part.contentJson.text ?? '');
	}
	if (typeof part.content === 'string') {
		try {
			const parsed = JSON.parse(part.content);
			if (parsed && typeof parsed.text === 'string') return parsed.text;
		} catch {}
		return part.content;
	}
	return '';
}

function getSortedParts(message: Message): MessagePart[] {
	if (!message.parts?.length) return [];
	return [...message.parts].sort((a, b) => {
		const indexDiff = (a.index ?? 0) - (b.index ?? 0);
		if (indexDiff !== 0) return indexDiff;
		return (a.startedAt ?? 0) - (b.startedAt ?? 0);
	});
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SKIP_TOOLS = new Set(['finish', 'progress_update', 'update_todos']);

function isToolPart(part: MessagePart): boolean {
	return part.type === 'tool_call' || part.type === 'tool_result';
}

function getPartCategory(part: MessagePart): string {
	if (part.type === 'tool_call' || part.type === 'tool_result') return 'tool';
	return part.type;
}

function PartRenderer({ part, isActive, isLastTool, prevType }: { part: MessagePart; isActive: boolean; isLastTool: boolean; prevType: string | null }) {
	const category = getPartCategory(part);
	const needsTopGap = prevType === null || prevType !== category;

	if (part.type === 'text') {
		const text = extractText(part);
		if (!text.trim()) return null;
		return (
			<box style={{ width: '100%', marginTop: needsTopGap ? 1 : 0 }}>
				<markdown
					style={{ width: '100%' }}
					content={text}
					syntaxStyle={syntaxStyle}
					streaming={isActive && !part.completedAt}
					conceal
				/>
			</box>
		);
	}

	if (part.type === 'reasoning') {
		const text = extractText(part);
		if (!text.trim()) return null;
		return (
			<box style={{ flexDirection: 'row', gap: 1, paddingLeft: 1, marginTop: needsTopGap ? 1 : 0 }}>
				<text fg={colors.fgDark}>~</text>
				<text fg={colors.fgDark}>
					<i>{text.length > 200 ? `${text.slice(0, 197)}…` : text}</i>
				</text>
			</box>
		);
	}

	if (isToolPart(part)) {
		const toolName = part.toolName || '';
		if (SKIP_TOOLS.has(toolName)) return null;
		return <ToolCallItem part={part} isLast={isLastTool} isFirst={needsTopGap} />;
	}

	if (part.type === 'error') {
		const text = extractText(part);
		return (
			<box style={{ marginTop: 1, paddingLeft: 1 }}>
				<text fg={colors.red}>{text || 'Error occurred'}</text>
			</box>
		);
	}

	return null;
}

function UserMessage({ message, isFirstMessage }: { message: Message; isFirstMessage: boolean }) {
	const parts = useMemo(() => getSortedParts(message), [message.parts]);
	const content = useMemo(() => {
		return parts
			.filter((p) => p.type === 'text')
			.map(extractText)
			.join('');
	}, [parts]);

	return (
		<box
			style={{
				flexDirection: 'column',
				width: '100%',
				marginTop: isFirstMessage ? 0 : 1,
				backgroundColor: colors.userBg,
				paddingLeft: 1,
				paddingRight: 1,
				paddingTop: 0,
				paddingBottom: 0,
			}}
		>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.userBadge}>
					<b>you</b>
				</text>
				{message.createdAt > 0 && (
					<text fg={colors.fgDimmed}>{formatTime(message.createdAt)}</text>
				)}
			</box>
			<text fg={colors.fgBright}>{content}</text>
		</box>
	);
}

function deduplicateToolParts(parts: MessagePart[]): MessagePart[] {
	const resultCallIds = new Set<string>();
	for (const p of parts) {
		if (p.type === 'tool_result' && p.toolCallId) {
			resultCallIds.add(p.toolCallId);
		}
	}
	return parts.filter((p) => {
		if (p.type === 'tool_call' && p.toolCallId && resultCallIds.has(p.toolCallId)) {
			return false;
		}
		return true;
	});
}

function AssistantMessage({ message, isStreaming, isFirstMessage }: MessageItemProps) {
	const sortedParts = useMemo(() => getSortedParts(message), [message.parts]);
	const dedupedParts = useMemo(() => deduplicateToolParts(sortedParts), [sortedParts]);
	const isActive = isStreaming && message.status !== 'complete';
	const hasError = message.status === 'error';

	const toolParts = dedupedParts.filter((p) => isToolPart(p) && !SKIP_TOOLS.has(p.toolName || ''));
	const lastToolIdx = toolParts.length > 0 ? dedupedParts.lastIndexOf(toolParts[toolParts.length - 1]) : -1;

	const hasAnyContent = dedupedParts.some(
		(p) => (p.type === 'text' && extractText(p).trim()) || isToolPart(p) || p.type === 'reasoning',
	);

	return (
		<box
			style={{
				flexDirection: 'column',
				width: '100%',
				marginTop: isFirstMessage ? 0 : 1,
				backgroundColor: colors.assistantBg,
				paddingLeft: 1,
				paddingRight: 1,
				paddingTop: 1,
				paddingBottom: 1,
			}}
		>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.assistantBadge}>
					<b>assistant</b>
				</text>
				{message.provider && (
					<text fg={colors.fgDimmed}>{message.provider}</text>
				)}
				{message.createdAt > 0 && (
					<text fg={colors.fgDimmed}>{formatTime(message.createdAt)}</text>
				)}
				{message.totalTokens && message.status === 'complete' && (
					<text fg={colors.fgDimmed}>{message.totalTokens}tok</text>
				)}
			</box>

		{dedupedParts.map((part, i) => {
				const prev = i > 0 ? dedupedParts[i - 1] : null;
				const prevCat = prev ? getPartCategory(prev) : null;
				return (
					<PartRenderer
						key={part.id}
						part={part}
						isActive={isActive}
						isLastTool={i === lastToolIdx}
						prevType={prevCat}
					/>
				);
			})}

			{!hasAnyContent && isActive && (
				<text fg={colors.fgDark}>thinking…</text>
			)}

			{hasError && !sortedParts.some((p) => p.type === 'error') && (
				<text fg={colors.red}>{message.error || 'Unknown error'}</text>
			)}
		</box>
	);
}

export function MessageItem({ message, isStreaming, isFirstMessage }: MessageItemProps) {
	if (message.role === 'user') {
		return <UserMessage message={message} isFirstMessage={isFirstMessage} />;
	}
	if (message.role === 'assistant') {
		return <AssistantMessage message={message} isStreaming={isStreaming} isFirstMessage={isFirstMessage} />;
	}
	return null;
}
