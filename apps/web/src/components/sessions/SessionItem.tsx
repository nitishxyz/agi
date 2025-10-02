import { MessageSquare, Clock } from 'lucide-react';
import type { Session } from '../../types/api';

interface SessionItemProps {
	session: Session;
	isActive: boolean;
	onClick: () => void;
}

export function SessionItem({ session, isActive, onClick }: SessionItemProps) {
	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	return (
		<button
			onClick={onClick}
			className={`w-full p-3 text-left border-b border-border hover:bg-muted/50 transition-colors ${
				isActive ? 'bg-muted/50 border-l-2 border-l-primary' : ''
			}`}
		>
			<div className="flex items-start gap-3">
				<MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<h3 className="text-sm font-medium text-foreground truncate">
						{session.title || `Session ${session.id.slice(0, 8)}`}
					</h3>
					<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
						<span className="truncate">{session.agent}</span>
						<span>•</span>
						<span className="truncate">{session.model}</span>
					</div>
					<div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
						<Clock className="w-3 h-3" />
						<span>{formatDate(session.lastActiveAt || session.createdAt)}</span>
					</div>
				</div>
			</div>
		</button>
	);
}
