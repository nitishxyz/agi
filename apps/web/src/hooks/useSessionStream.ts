import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SSEClient } from '../lib/sse-client';
import { apiClient } from '../lib/api-client';

export function useSessionStream(sessionId: string | undefined) {
	const queryClient = useQueryClient();
	const clientRef = useRef<SSEClient | null>(null);

	useEffect(() => {
		console.log('[useSessionStream] Hook called with sessionId:', sessionId);
		if (!sessionId) {
			console.log('[useSessionStream] No sessionId, skipping');
			return;
		}

		const client = new SSEClient();
		clientRef.current = client;

		const url = apiClient.getStreamUrl(sessionId);
		console.log('[useSessionStream] Connecting to stream:', url);
		client.connect(url);

		const unsubscribe = client.on('*', (event) => {
			console.log('[useSessionStream] Event received:', event);
			if (
				event.type === 'message.part.delta' ||
				event.type === 'message.completed' ||
				event.type === 'tool.result' ||
				event.type === 'finish-step'
			) {
				console.log('[useSessionStream] Invalidating messages query');
				queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
			}
		});

		return () => {
			unsubscribe();
			client.disconnect();
		};
	}, [sessionId, queryClient]);
}
