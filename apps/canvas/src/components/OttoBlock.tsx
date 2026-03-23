import { useCallback, useRef, useState } from 'react';
import {
	MessageThreadContainer,
	ChatInputContainer,
	NewSessionLanding,
	configureApiClient,
} from '@ottocode/web-sdk';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';

configureApiClient();

interface OttoBlockProps {
	block: Block;
	isFocused: boolean;
}

export function OttoBlock({ block }: OttoBlockProps) {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleSessionCreated = useCallback((id: string) => {
		setSessionId(id);
	}, []);

	const handleNewSession = useCallback(() => {
		setSessionId(null);
	}, []);

	const handleSelectSession = useCallback((id: string) => {
		setSessionId(id);
	}, []);

	return (
		<div
			ref={containerRef}
			className="dark relative flex h-full w-full flex-col overflow-hidden"
			style={{ background: 'hsl(var(--background))' }}
			onClick={() => setFocused(block.id)}
		>
			{sessionId ? (
				<>
					<div className="relative flex-1 min-h-0">
						<MessageThreadContainer
							sessionId={sessionId}
							onSelectSession={handleSelectSession}
						/>
					</div>
					<div className="flex-shrink-0 border-t border-border px-2 pb-2">
						<ChatInputContainer
							sessionId={sessionId}
							onNewSession={handleNewSession}
						/>
					</div>
				</>
			) : (
				<NewSessionLanding
					onSessionCreated={handleSessionCreated}
					compact
				/>
			)}
		</div>
	);
}
