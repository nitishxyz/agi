import { memo } from 'react';
import { Plug } from 'lucide-react';
import { useMCPStore } from '../../stores/mcpStore';

export const MCPSidebarToggle = memo(function MCPSidebarToggle() {
	const isExpanded = useMCPStore((state) => state.isExpanded);
	const toggleSidebar = useMCPStore((state) => state.toggleSidebar);
	const servers = useMCPStore((state) => state.servers);

	const connectedCount = servers.filter((s) => s.connected).length;

	return (
		<button
			type="button"
			onClick={toggleSidebar}
			className={`relative h-14 w-full transition-colors touch-manipulation flex items-center justify-center ${
				isExpanded ? 'bg-muted border-r-2 border-primary' : 'hover:bg-muted/50'
			}`}
			title="MCP Servers"
		>
			<Plug className="w-5 h-5 text-muted-foreground mx-auto" />
			{connectedCount > 0 && (
				<span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
			)}
		</button>
	);
});
