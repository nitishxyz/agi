import { memo } from 'react';
import type { Session } from '../../types/api';
import { formatRelativeSessionTime } from './session-time';

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
	const lastUpdatedAt = session.lastActiveAt ?? session.createdAt;
	const metadata = formatRelativeSessionTime(lastUpdatedAt);

	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 ${
				isActive
					? 'bg-sidebar-accent text-sidebar-foreground'
					: 'text-sidebar-foreground hover:bg-sidebar-accent/50'
			}`}
			title={`${title} — ${metadata}`}
		>
			<span className="block min-w-0">
				<span
					className={`block truncate text-[13px] leading-5 ${isActive ? 'font-medium' : 'font-normal'}`}
				>
					{title}
				</span>
				<span className="mt-0.5 flex items-center justify-between gap-3 text-[11px] leading-4 text-sidebar-muted-foreground">
					<span className="truncate">{metadata}</span>
					<span className="relative flex h-2 w-2 shrink-0">
						{isRunning && (
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
						)}
						<span
							className={`relative inline-flex h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-sidebar-muted-foreground/35'}`}
						/>
					</span>
				</span>
			</span>
		</button>
	);
});
