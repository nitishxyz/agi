import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSessions } from '../../hooks/useSessions';
import { SessionItem } from './SessionItem';
import { useFocusStore } from '../../stores/focusStore';

interface SessionListContainerProps {
	activeSessionId?: string;
	onSelectSession: (sessionId: string) => void;
}

export const SessionListContainer = memo(function SessionListContainer({
	activeSessionId,
	onSelectSession,
}: SessionListContainerProps) {
	const { data: sessions = [], isLoading } = useSessions();
	const { currentFocus, sessionIndex } = useFocusStore();
	const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	const handleSessionClick = useCallback(
		(sessionId: string) => {
			onSelectSession(sessionId);
		},
		[onSelectSession],
	);

	// Create a stable reference that only changes when session count, titles, or agents change
	const sessionSnapshot = useMemo(() => {
		return sessions.map((s) => ({
			id: s.id,
			title: s.title,
			agent: s.agent,
			createdAt: s.createdAt,
		}));
	}, [sessions]);

	useEffect(() => {
		if (currentFocus === 'sessions') {
			const element = itemRefs.current.get(sessionIndex);
			element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}, [currentFocus, sessionIndex]);

	if (isLoading) {
		return (
			<div className="px-4 py-8 text-center text-sm text-muted-foreground/80">
				Loading sessions...
			</div>
		);
	}

	if (sessionSnapshot.length === 0) {
		return (
			<div className="px-4 py-8 text-center text-sm text-muted-foreground/80">
				No sessions yet. Create one to get started.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1 px-2 py-2 overflow-y-auto scrollbar-hide">
			{sessionSnapshot.map((session, index) => {
				const fullSession = sessions.find((s) => s.id === session.id);
				if (!fullSession) return null;
				const isFocused = currentFocus === 'sessions' && sessionIndex === index;

				return (
					<div
						key={session.id}
						ref={(el) => {
						if (el) itemRefs.current.set(index, el);
						else itemRefs.current.delete(index);
					}}
					className={isFocused ? 'ring-1 ring-primary/40 rounded-md' : ''}
				>
					<SessionItem
							session={fullSession}
							isActive={session.id === activeSessionId}
							onClick={() => handleSessionClick(session.id)}
						/>
					</div>
				);
			})}
		</div>
	);
});
