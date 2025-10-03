import type { Session } from '../../types/api';
import { SessionItem } from './SessionItem';

interface SessionListProps {
	sessions: Session[];
	activeSessionId?: string;
	onSelectSession: (sessionId: string) => void;
}

export function SessionList({
	sessions,
	activeSessionId,
	onSelectSession,
}: SessionListProps) {
	if (sessions.length === 0) {
		return (
			<div className="px-4 py-8 text-center text-sm text-muted-foreground/80">
				No sessions yet. Create one to get started.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1 px-2 py-2 overflow-y-auto scrollbar-hide">
			{sessions.map((session) => (
				<SessionItem
					key={session.id}
					session={session}
					isActive={session.id === activeSessionId}
					onClick={() => onSelectSession(session.id)}
				/>
			))}
		</div>
	);
}
