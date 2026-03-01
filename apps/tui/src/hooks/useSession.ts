import { useState, useCallback, useEffect, useRef } from 'react';
import {
	listSessions,
	createSession as apiCreateSession,
	deleteSession as apiDeleteSession,
	createMessage,
	abortSession as apiAbortSession,
	resolveApproval,
} from '@ottocode/api';
import type { Session } from '../types.ts';

const PAGE_SIZE = 50;

function sortSessions(list: Session[]): Session[] {
	return [...list].sort((a, b) => {
		const aTime = a.lastActiveAt ?? a.createdAt ?? 0;
		const bTime = b.lastActiveAt ?? b.createdAt ?? 0;
		return bTime - aTime;
	});
}

export function useSession() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSession, setActiveSession] = useState<Session | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const nextOffsetRef = useRef<number | null>(null);

	const loadSessions = useCallback(async () => {
		try {
			const response = await listSessions({
				query: { limit: PAGE_SIZE, offset: 0 },
			});
			const data = response.data;
			const sorted = sortSessions((data?.items ?? []) as Session[]);
			setSessions(sorted);
			setHasMore(data?.hasMore ?? false);
			nextOffsetRef.current = data?.nextOffset ?? null;
			return sorted;
		} catch {
			return [];
		}
	}, []);

	const loadMoreSessions = useCallback(async () => {
		if (loadingMore || !hasMore || nextOffsetRef.current === null) return;
		setLoadingMore(true);
		try {
			const response = await listSessions({
				query: { limit: PAGE_SIZE, offset: nextOffsetRef.current },
			});
			const data = response.data;
			const newItems = (data?.items ?? []) as Session[];
			setSessions((prev) => {
				const existingIds = new Set(prev.map((s) => s.id));
				const unique = newItems.filter((s) => !existingIds.has(s.id));
				return sortSessions([...prev, ...unique]);
			});
			setHasMore(data?.hasMore ?? false);
			nextOffsetRef.current = data?.nextOffset ?? null;
		} catch {
		} finally {
			setLoadingMore(false);
		}
	}, [loadingMore, hasMore]);

	const createSession = useCallback(
		async (title?: string): Promise<Session | null> => {
			try {
				const response = await apiCreateSession({ body: { title } });
				const session = response.data as Session;
				if (!session) return null;
				setSessions((prev) => sortSessions([session, ...prev]));
				setActiveSession(session);
				return session;
			} catch {
				return null;
			}
		},
		[],
	);

	const deleteSessionFn = useCallback(
		async (id: string) => {
			try {
				await apiDeleteSession({ path: { sessionId: id } });
				setSessions((prev) => prev.filter((s) => s.id !== id));
				if (activeSession?.id === id) {
					setActiveSession(null);
				}
			} catch {}
		},
		[activeSession],
	);

	const switchSession = useCallback((session: Session) => {
		setActiveSession(session);
	}, []);

	const sendMessage = useCallback(
		async (sessionId: string, content: string) => {
			try {
				await createMessage({ path: { id: sessionId }, body: { content } });
			} catch {}
		},
		[],
	);

	const abortSessionFn = useCallback(async (sessionId: string) => {
		try {
			await apiAbortSession({ path: { sessionId } });
		} catch {}
	}, []);

	const approveToolCall = useCallback(
		async (sessionId: string, callId: string, approved: boolean) => {
			try {
				await resolveApproval({
					path: { id: sessionId },
					body: { callId, approved },
				});
			} catch {}
		},
		[],
	);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	return {
		sessions,
		activeSession,
		hasMore,
		loadingMore,
		loadSessions,
		loadMoreSessions,
		createSession,
		deleteSession: deleteSessionFn,
		switchSession,
		sendMessage,
		abortSession: abortSessionFn,
		approveToolCall,
	};
}
