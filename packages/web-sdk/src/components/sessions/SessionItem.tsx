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

	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors duration-150 ${
				isActive
					? 'bg-sidebar-accent font-medium text-sidebar-foreground'
					: 'text-sidebar-foreground hover:bg-sidebar-accent/50'
			}`}
			title={title}
		>
			{title}
		</button>
	);
});
