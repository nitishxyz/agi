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
			<div className="p-4 text-center text-muted-foreground text-sm">
				No sessions yet. Create one to get started.
			</div>
		);
	}

	return (
		<div className="flex flex-col">
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
