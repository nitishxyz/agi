import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSessions } from '../../hooks/useSessions';
import { SessionItem } from './SessionItem';
import { useFocusStore } from '../../stores/focusStore';
import { Loader2 } from 'lucide-react';

interface SessionListContainerProps {
	activeSessionId?: string;
	onSelectSession: (sessionId: string) => void;
}

export const SessionListContainer = memo(function SessionListContainer({
	activeSessionId,
	onSelectSession,
}: SessionListContainerProps) {
	const {
		data: sessions = [],
		isLoading,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
	} = useSessions();
	const { currentFocus, sessionIndex } = useFocusStore();
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const lastScrolledSessionId = useRef<string | undefined>(undefined);

	const handleSessionClick = useCallback(
		(sessionId: string) => {
			lastScrolledSessionId.current = sessionId;
			onSelectSession(sessionId);
		},
		[onSelectSession],
	);

	const sessionSnapshot = useMemo(() => {
		return sessions.map((s) => ({
			id: s.id,
			title: s.title,
			agent: s.agent,
			createdAt: s.createdAt,
			lastActiveAt: s.lastActiveAt,
		}));
	}, [sessions]);

	const sessionMap = useMemo(
		() => new Map(sessions.map((session) => [session.id, session])),
		[sessions],
	);

	const recents = sessionSnapshot;

	useEffect(() => {
		if (currentFocus === 'sessions') {
			const session = sessionSnapshot[sessionIndex];
			if (session) {
				const element = itemRefs.current.get(session.id);
				element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}
		}
	}, [currentFocus, sessionIndex, sessionSnapshot]);

	useEffect(() => {
		if (
			!activeSessionId ||
			lastScrolledSessionId.current === activeSessionId ||
			sessions.length === 0
		)
			return;

		const activeIndex = sessions.findIndex((s) => s.id === activeSessionId);
		if (activeIndex === -1 && hasNextPage) {
			fetchNextPage();
			return;
		}

		if (activeIndex !== -1) {
			lastScrolledSessionId.current = activeSessionId;
			requestAnimationFrame(() => {
				const element = itemRefs.current.get(activeSessionId);
				element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			});
		}
	}, [activeSessionId, sessions, hasNextPage, fetchNextPage]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			if (
				scrollHeight - scrollTop - clientHeight < 100 &&
				hasNextPage &&
				!isFetchingNextPage
			) {
				fetchNextPage();
			}
		};

		container.addEventListener('scroll', handleScroll, { passive: true });
		return () => container.removeEventListener('scroll', handleScroll);
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 px-3 py-2">
				<div className="h-8 rounded-md bg-sidebar-accent/50 animate-pulse" />
				<div className="h-8 rounded-md bg-sidebar-accent/50 animate-pulse" />
				<div className="h-8 rounded-md bg-sidebar-accent/50 animate-pulse" />
				<div className="h-8 rounded-md bg-sidebar-accent/50 animate-pulse" />
			</div>
		);
	}

	if (sessionSnapshot.length === 0) {
		return (
			<div className="px-4 py-8 text-center text-sm text-sidebar-muted-foreground">
				No sessions yet. Create one to get started.
			</div>
		);
	}

	const renderSession = (
		session: (typeof sessionSnapshot)[0],
		index: number,
	) => {
		const fullSession = sessionMap.get(session.id);
		if (!fullSession) return null;
		const isFocused = currentFocus === 'sessions' && sessionIndex === index;

		return (
			<div
				key={session.id}
				ref={(el) => {
					if (el) itemRefs.current.set(session.id, el);
					else itemRefs.current.delete(session.id);
				}}
				className={isFocused ? 'ring-1 ring-sidebar-ring/40 rounded-md' : ''}
			>
				<SessionItem
					session={fullSession}
					isActive={session.id === activeSessionId}
					onClick={() => handleSessionClick(session.id)}
				/>
			</div>
		);
	};

	return (
		<div
			ref={scrollContainerRef}
			className="flex flex-col h-full overflow-y-auto scrollbar-hide"
		>
			<div className="h-14 shrink-0" aria-hidden="true" />
			{recents.length > 0 && (
				<div className="px-3 pt-4 pb-1">
					<h3 className="text-xs font-medium text-sidebar-muted-foreground uppercase tracking-wider px-3 mb-2">
						Recents
					</h3>
					<div className="flex flex-col gap-0.5">
						{recents.map((session, index) => renderSession(session, index))}
					</div>
				</div>
			)}

			{isFetchingNextPage && (
				<div className="flex justify-center py-3">
					<Loader2 className="h-4 w-4 animate-spin text-sidebar-muted-foreground" />
				</div>
			)}
		</div>
	);
});
