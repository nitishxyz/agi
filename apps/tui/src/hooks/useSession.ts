import { useState, useCallback, useEffect } from 'react';
import { fetchJson } from '../api.ts';
import type { Session } from '../types.ts';

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
	const [loading, setLoading] = useState(false);

	const loadSessions = useCallback(async () => {
		try {
			const data = await fetchJson<{ items?: Session[] } | Session[]>('/v1/sessions?limit=200');
			const list = Array.isArray(data) ? data : data.items || [];
			const sorted = sortSessions(list);
			setSessions(sorted);
			return sorted;
		} catch {
			return [];
		}
	}, []);

	const createSession = useCallback(async (title?: string): Promise<Session | null> => {
		try {
			const session = await fetchJson<Session>('/v1/sessions', {
				method: 'POST',
				body: JSON.stringify({ title }),
			});
			setSessions((prev) => sortSessions([session, ...prev]));
			setActiveSession(session);
			return session;
		} catch {
			return null;
		}
	}, []);

	const deleteSession = useCallback(async (id: string) => {
		try {
			await fetchJson('/v1/sessions/' + id, { method: 'DELETE' });
			setSessions((prev) => prev.filter((s) => s.id !== id));
			if (activeSession?.id === id) {
				setActiveSession(null);
			}
		} catch {}
	}, [activeSession]);

	const switchSession = useCallback((session: Session) => {
		setActiveSession(session);
	}, []);

	const sendMessage = useCallback(async (sessionId: string, content: string) => {
		try {
			await fetchJson(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				body: JSON.stringify({ content }),
			});
		} catch {}
	}, []);

	const abortSession = useCallback(async (sessionId: string) => {
		try {
			await fetchJson(`/v1/sessions/${sessionId}/abort`, {
				method: 'POST',
			});
		} catch {}
	}, []);

	const approveToolCall = useCallback(async (sessionId: string, callId: string, approved: boolean) => {
		try {
			await fetchJson(`/v1/sessions/${sessionId}/approval`, {
				method: 'POST',
				body: JSON.stringify({ callId, approved }),
			});
		} catch {}
	}, []);

	useEffect(() => {
		loadSessions();
	}, []);

	return {
		sessions,
		activeSession,
		loading,
		loadSessions,
		createSession,
		deleteSession,
		switchSession,
		sendMessage,
		abortSession,
		approveToolCall,
	};
}
