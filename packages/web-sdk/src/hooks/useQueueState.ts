import { useQuery, useQueryClient } from '@tanstack/react-query';

export type QueueState = {
	currentMessageId: string | null;
	queuedMessages: Array<{ messageId: string; position: number }>;
	queueLength: number;
};

const defaultQueueState: QueueState = {
	currentMessageId: null,
	queuedMessages: [],
	queueLength: 0,
};

export function useQueueState(sessionId: string | undefined): QueueState {
	const { data } = useQuery<QueueState>({
		queryKey: ['queueState', sessionId],
		enabled: !!sessionId,
		initialData: defaultQueueState,
		staleTime: Infinity,
	});

	return data ?? defaultQueueState;
}

export function useMessageQueuePosition(
	sessionId: string | undefined,
	messageId: string,
): { isQueued: boolean; isRunning: boolean; position: number | null } {
	const queueState = useQueueState(sessionId);

	if (!sessionId || !queueState) {
		return { isQueued: false, isRunning: false, position: null };
	}

	if (queueState.currentMessageId === messageId) {
		return { isQueued: false, isRunning: true, position: null };
	}

	const queuedItem = queueState.queuedMessages.find(
		(item) => item.messageId === messageId,
	);

	if (queuedItem) {
		return { isQueued: true, isRunning: false, position: queuedItem.position };
	}

	return { isQueued: false, isRunning: false, position: null };
}
