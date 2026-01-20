import { memo } from 'react';
import { MessageSquare, GitBranch } from 'lucide-react';
import type { Session } from '../../types/api';

interface SessionItemProps {
	session: Session;
	isActive: boolean;
	onClick: () => void;
}

export const SessionItem = memo(function SessionItem({
	session,
	isActive,
	onClick,
}: SessionItemProps) {
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

	const isBranch = session.sessionType === 'branch';

	const baseStyles =
		'group w-full rounded-lg px-3 py-3 text-left transition-colors duration-150';
	const activeStyles = 'bg-primary/10';
	const inactiveStyles = 'hover:bg-muted/20';

	return (
		<button
			type="button"
			onClick={onClick}
			className={`${baseStyles} ${isActive ? activeStyles : inactiveStyles}`}
		>
			<div className="flex items-start gap-3">
				{isBranch ? (
					<GitBranch
						className={`h-4 w-4 shrink-0 mt-1 text-muted-foreground ${isActive ? 'text-primary' : ''}`}
					/>
				) : (
					<MessageSquare
						className={`h-4 w-4 shrink-0 mt-1 text-muted-foreground ${isActive ? 'text-primary' : ''}`}
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h3 className="truncate text-sm font-semibold text-foreground">
							{session.title || `Session ${session.id.slice(0, 8)}`}
						</h3>
						{isBranch && (
							<span className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full shrink-0">
								branch
							</span>
						)}
					</div>
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/80">
						{session.agent && (
							<span className="uppercase">{session.agent}</span>
						)}
						{session.agent && <span>•</span>}
						<span>{formatDate(session.lastActiveAt || session.createdAt)}</span>
					</div>
				</div>
			</div>
		</button>
	);
});
