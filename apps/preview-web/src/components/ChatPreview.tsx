import type { FC } from 'react';
import { AssistantMessageGroup, UserMessageGroup } from '@agi-cli/web-sdk';
import type { Message } from '@agi-cli/web-sdk';
import { Clock, Eye, Hash, User, Cpu } from 'lucide-react';

interface SharedSessionData {
	title: string | null;
	username: string;
	agent: string;
	provider: string;
	model: string;
	createdAt: number;
	tokenCount?: number;
	messages: SharedMessage[];
}

interface SharedMessage {
	id: string;
	role: 'user' | 'assistant';
	createdAt: number;
	parts: SharedMessagePart[];
}

interface SharedMessagePart {
	type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'reasoning' | 'error';
	content: string;
	toolName?: string;
	toolCallId?: string;
}

interface ChatPreviewProps {
	data: {
		shareId: string;
		title: string | null;
		description: string | null;
		sessionData: SharedSessionData;
		createdAt: number;
		viewCount: number;
	};
}

function parseTextContent(content: string): string {
	try {
		const parsed = JSON.parse(content);
		if (typeof parsed === 'object' && parsed !== null) {
			return parsed.text || parsed.content || parsed.message || JSON.stringify(parsed, null, 2);
		}
		return content;
	} catch {
		return content;
	}
}

function transformMessages(
	sharedMessages: SharedMessage[],
	sessionData: SharedSessionData,
	shareId: string
): Message[] {
	return sharedMessages.map((msg) => ({
		id: msg.id,
		sessionId: shareId,
		role: msg.role as Message['role'],
		status: 'complete' as const,
		agent: sessionData.agent,
		provider: sessionData.provider,
		model: sessionData.model,
		createdAt: msg.createdAt,
		completedAt: msg.createdAt,
		latencyMs: null,
		promptTokens: null,
		completionTokens: null,
		totalTokens: null,
		error: null,
		parts: msg.parts.map((part, partIndex) => ({
			id: `${msg.id}-part-${partIndex}`,
			messageId: msg.id,
			index: partIndex,
			stepIndex: null,
			type: part.type === 'thinking' ? 'reasoning' : part.type,
			content: (part.type === 'text' || part.type === 'thinking' || part.type === 'reasoning') 
				? parseTextContent(part.content)
				: part.content,
			agent: sessionData.agent,
			provider: sessionData.provider,
			model: sessionData.model,
			startedAt: msg.createdAt,
			completedAt: msg.createdAt,
			toolName: part.toolName ?? null,
			toolCallId: part.toolCallId ?? null,
			toolDurationMs: null,
		})),
	}));
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function formatCompactNumber(num: number): string {
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
}

const ChatPreview: FC<ChatPreviewProps> = ({ data }) => {
	const { sessionData, shareId, title, createdAt, viewCount } = data;
	const messages = transformMessages(sessionData.messages, sessionData, shareId);
	const filteredMessages = messages.filter((m) => m.role !== 'system');

	return (
		<div className="min-h-screen bg-background">
			{/* Blog-style Header */}
			<header className="border-b border-border">
				<div className="max-w-3xl mx-auto px-6 py-8">
					<h1 className="text-3xl font-bold text-foreground leading-tight mb-4">
						{title || sessionData.title || 'Untitled Session'}
					</h1>
					
					<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						{sessionData.username && (
							<div className="flex items-center gap-1.5">
								<User className="w-4 h-4" />
								<span className="font-medium text-foreground">{sessionData.username}</span>
							</div>
						)}
						
						<div className="flex items-center gap-1.5">
							<Clock className="w-4 h-4" />
							<span>{formatDate(createdAt)}</span>
						</div>

						<div className="flex items-center gap-1.5">
							<Cpu className="w-4 h-4" />
							<span className="font-medium text-foreground">{sessionData.model}</span>
							<span className="opacity-50">·</span>
							<span>{sessionData.provider}</span>
						</div>

						{sessionData.tokenCount && sessionData.tokenCount > 0 && (
							<div className="flex items-center gap-1.5">
								<Hash className="w-4 h-4" />
								<span>{formatCompactNumber(sessionData.tokenCount)} tokens</span>
							</div>
						)}

						<div className="flex items-center gap-1.5">
							<Eye className="w-4 h-4" />
							<span>{viewCount} views</span>
						</div>
					</div>
				</div>
			</header>

			{/* Messages */}
			<main className="max-w-3xl mx-auto px-6 py-8">
				<div className="space-y-6">
					{filteredMessages.map((message, idx) => {
						const prevMessage = filteredMessages[idx - 1];
						const nextMessage = filteredMessages[idx + 1];
						const isLastMessage = idx === filteredMessages.length - 1;

						if (message.role === 'user') {
							const nextAssistantMessage =
								nextMessage && nextMessage.role === 'assistant'
									? nextMessage
									: undefined;
							return (
								<UserMessageGroup
									key={message.id}
									sessionId={shareId}
									message={message}
									isFirst={idx === 0}
									nextAssistantMessageId={nextAssistantMessage?.id}
								/>
							);
						}

						if (message.role === 'assistant') {
							const showHeader =
								!prevMessage || prevMessage.role !== 'assistant';
							const nextIsAssistant =
								nextMessage && nextMessage.role === 'assistant';

							return (
								<AssistantMessageGroup
									key={message.id}
									sessionId={shareId}
									message={message}
									showHeader={showHeader}
									hasNextAssistantMessage={nextIsAssistant}
									isLastMessage={isLastMessage}
								/>
							);
						}

						return null;
					})}
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-border py-6 mt-8">
				<div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
					<div className="flex items-center gap-2">
						{sessionData.username && (
							<>
								<span>Shared by</span>
								<span className="font-medium text-foreground">{sessionData.username}</span>
								<span className="opacity-50">·</span>
							</>
						)}
						<span>{sessionData.messages.length} messages</span>
					</div>
					<a
						href="https://github.com/sst/opencode"
						className="text-primary hover:underline flex items-center gap-1"
						target="_blank"
						rel="noopener noreferrer"
					>
						Powered by AGI
					</a>
				</div>
			</footer>
		</div>
	);
};

export default ChatPreview;
