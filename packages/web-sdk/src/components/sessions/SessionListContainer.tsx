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
	const hasScrolledToActive = useRef(false);

	const handleSessionClick = useCallback(
		(sessionId: string) => {
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
		}));
	}, [sessions]);

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
			hasScrolledToActive.current ||
			sessions.length === 0
		)
			return;

		const activeIndex = sessions.findIndex((s) => s.id === activeSessionId);
		if (activeIndex === -1 && hasNextPage) {
			fetchNextPage();
			return;
		}

		if (activeIndex !== -1) {
			hasScrolledToActive.current = true;
			requestAnimationFrame(() => {
				const element = itemRefs.current.get(activeSessionId);
				element?.scrollIntoView({ block: 'center', behavior: 'instant' });
			});
		}
	}, [activeSessionId, sessions, hasNextPage, fetchNextPage]);

	useEffect(() => {
		hasScrolledToActive.current = false;
	}, [activeSessionId]);

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
			<div className="flex flex-col gap-2 px-2 py-2">
				<div className="h-12 rounded-md bg-muted/30 animate-pulse" />
				<div className="h-12 rounded-md bg-muted/30 animate-pulse" />
				<div className="h-12 rounded-md bg-muted/30 animate-pulse" />
				<div className="h-12 rounded-md bg-muted/30 animate-pulse" />
				<div className="h-12 rounded-md bg-muted/30 animate-pulse" />
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
		<div
			ref={scrollContainerRef}
			className="flex flex-col gap-1 px-2 py-2 overflow-y-auto scrollbar-hide"
		>
			{sessionSnapshot.map((session, index) => {
				const fullSession = sessions.find((s) => s.id === session.id);
				if (!fullSession) return null;
				const isFocused = currentFocus === 'sessions' && sessionIndex === index;

				return (
					<div
						key={session.id}
						ref={(el) => {
							if (el) itemRefs.current.set(session.id, el);
							else itemRefs.current.delete(session.id);
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
			{isFetchingNextPage && (
				<div className="flex justify-center py-3">
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</div>
			)}
		</div>
	);
});
