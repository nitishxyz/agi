import { memo } from 'react';
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
	const title = session.title || `Session ${session.id.slice(0, 8)}`;
	const isRunning = session.isRunning ?? false;

	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2 ${
				isActive
					? 'bg-sidebar-accent font-medium text-sidebar-foreground'
					: 'text-sidebar-foreground hover:bg-sidebar-accent/50'
			}`}
			title={title}
		>
			{isRunning && (
				<span className="relative flex h-2 w-2 shrink-0">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
				</span>
			)}
			<span className="truncate">{title}</span>
		</button>
	);
});
