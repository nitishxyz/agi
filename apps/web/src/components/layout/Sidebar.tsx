import { memo } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { Button } from '../ui/Button';

interface SidebarProps {
	children: ReactNode;
	onNewSession?: () => void;
}

export const Sidebar = memo(function Sidebar({
	children,
	onNewSession,
}: SidebarProps) {
	// Use selectors to subscribe only to specific state slices
	const isDiffOpen = useGitStore((state) => state.isDiffOpen);
	const isCollapsed = useSidebarStore((state) => state.isCollapsed);
	const toggleCollapse = useSidebarStore((state) => state.toggleCollapse);

	// When collapsed (including auto-collapse from diff), show minimal sidebar with expand button in footer
	if (isCollapsed) {
		return (
			<aside className="w-12 border-r border-border bg-background flex flex-col transition-all duration-300 ease-in-out">
				{/* Header with New Session icon */}
				<div className="h-14 border-b border-border flex items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={onNewSession}
						title="New session"
						className="rounded-full"
					>
						<Plus className="w-4 h-4" />
					</Button>
				</div>

				{/* Spacer to push footer to bottom */}
				<div className="flex-1" />

				{/* Footer with Expand button */}
				<div className="border-t border-border p-2 flex items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleCollapse}
						title="Expand sidebar"
						disabled={isDiffOpen}
						className="transition-transform duration-200 hover:scale-110"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</aside>
		);
	}

	return (
		<aside className="w-64 border-r border-border bg-background flex flex-col transition-all duration-300 ease-in-out">
			{/* Header with New Session button */}
			<div className="h-14 border-b border-border px-4 flex items-center">
				<Button
					variant="primary"
					size="sm"
					onClick={onNewSession}
					className="flex-1"
				>
					<Plus className="w-4 h-4 mr-2" />
					New Session
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto scrollbar-hide">{children}</div>

			{/* Footer with Collapse button aligned to the right */}
			<div className="border-t border-border p-2 flex items-center justify-end">
				<Button
					variant="ghost"
					size="icon"
					onClick={toggleCollapse}
					title="Collapse sidebar"
					disabled={isDiffOpen}
					className="transition-transform duration-200 hover:scale-110"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="transition-transform duration-300"
						role="img"
						aria-label="Collapse sidebar"
					>
						<title>Collapse sidebar</title>
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</Button>
			</div>
		</aside>
	);
});
