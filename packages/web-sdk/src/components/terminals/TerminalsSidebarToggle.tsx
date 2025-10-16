import { memo } from 'react';
import { Terminal } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useTerminals } from '../../hooks/useTerminals';

export const TerminalsSidebarToggle = memo(function TerminalsSidebarToggle() {
	const isExpanded = useTerminalStore((state) => state.isExpanded);
	const toggleSidebar = useTerminalStore((state) => state.toggleSidebar);
	const { data } = useTerminals();

	const terminalCount = data?.count ?? 0;

	return (
		<button
			type="button"
			onClick={toggleSidebar}
			className={`relative p-3 w-full transition-colors touch-manipulation ${
				isExpanded ? 'bg-muted border-r-2 border-primary' : 'hover:bg-muted/50'
			}`}
			title="Terminals"
		>
			<Terminal className="w-5 h-5 text-muted-foreground mx-auto" />
			{terminalCount > 0 && (
				<span className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
					{terminalCount > 9 ? '9+' : terminalCount}
				</span>
			)}
		</button>
	);
});
