import type { ReactNode } from 'react';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { Button } from '../ui/Button';

interface SidebarProps {
	children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
	const isDiffOpen = useGitStore((state) => state.isDiffOpen);
	const { isCollapsed, toggleCollapse } = useSidebarStore();

	// When collapsed (including auto-collapse from diff), show minimal sidebar with icon button
	if (isCollapsed) {
		return (
			<aside className="w-12 border-r border-border bg-background flex flex-col">
				<div className="h-14 border-b border-border flex items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleCollapse}
						title="Expand sessions"
						disabled={isDiffOpen} // Disable manual toggle while diff is open
					>
						<MessageSquare className="w-4 h-4" />
					</Button>
				</div>
			</aside>
		);
	}

	return (
		<aside className="w-64 border-r border-border bg-background flex flex-col">
			{/* Header */}
			<div className="h-14 border-b border-border px-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<MessageSquare className="w-4 h-4 text-muted-foreground" />
					<span className="font-medium text-foreground">Sessions</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={toggleCollapse}
					title="Collapse sidebar"
					disabled={isDiffOpen} // Disable manual toggle while diff is open
				>
					<ChevronLeft className="w-4 h-4" />
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto scrollbar-hide">
				{children}
			</div>
		</aside>
	);
}
