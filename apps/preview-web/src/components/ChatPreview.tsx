import type { FC } from 'react';
import { MessageThread } from '@agi-cli/web-sdk';
import type { Message, Session } from '@agi-cli/web-sdk';

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
	type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error';
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

// Parse content that might be JSON with a text field
function parseTextContent(content: string): string {
	try {
		const parsed = JSON.parse(content);
		if (typeof parsed === 'object' && parsed !== null) {
			// Handle various JSON formats
			return parsed.text || parsed.content || parsed.message || JSON.stringify(parsed, null, 2);
		}
		return content;
	} catch {
		return content;
	}
}

// Transform shared messages to web-sdk Message format
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
			// Parse JSON content for text and reasoning parts
			content: (part.type === 'text' || part.type === 'thinking') 
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

// Transform to web-sdk Session format
function transformSession(data: ChatPreviewProps['data']): Session {
	const { sessionData, shareId, title, createdAt } = data;
	return {
		id: shareId,
		title: title || sessionData.title,
		agent: sessionData.agent,
		provider: sessionData.provider,
		model: sessionData.model,
		projectPath: '',
		createdAt: sessionData.createdAt,
		lastActiveAt: createdAt,
		totalInputTokens: sessionData.tokenCount ?? null,
		totalOutputTokens: null,
		totalCachedTokens: null,
		totalCacheCreationTokens: null,
		totalToolTimeMs: null,
		toolCounts: {},
	};
}

const ChatPreview: FC<ChatPreviewProps> = ({ data }) => {
	const { sessionData, shareId } = data;

	const messages = transformMessages(sessionData.messages, sessionData, shareId);
	const session = transformSession(data);

	return (
		<div className="flex flex-col h-screen">
			{/* Message Thread - using web-sdk component */}
			<main className="flex-1 relative overflow-hidden">
				<MessageThread
					messages={messages}
					session={session}
					sessionId={shareId}
					isGenerating={false}
				/>
			</main>

			{/* Footer */}
			<footer className="border-t border-border p-3 text-center text-sm text-muted-foreground">
				Shared via{' '}
				<a
					href="https://github.com/nitishxyz/agi"
					className="text-primary underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					AGI
				</a>
			</footer>
		</div>
	);
};

export default ChatPreview;
