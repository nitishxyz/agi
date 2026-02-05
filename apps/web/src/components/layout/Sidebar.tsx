import { memo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useGitStore, useSidebarStore, usePanelWidthStore } from '@ottocode/web-sdk/stores';
import { Button, ResizeHandle } from '@ottocode/web-sdk/components';

const PANEL_KEY = 'left-sidebar';
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 256;
const MAX_WIDTH = 480;

interface SidebarProps {
	children: ReactNode;
	onNewSession?: () => void;
}

export const Sidebar = memo(function Sidebar({
	children,
	onNewSession,
}: SidebarProps) {
	const isDiffOpen = useGitStore((state) => state.isDiffOpen);
	const isCollapsed = useSidebarStore((state) => state.isCollapsed);
	const toggleCollapse = useSidebarStore((state) => state.toggleCollapse);
	const panelWidth = usePanelWidthStore((s) => s.widths[PANEL_KEY] ?? DEFAULT_WIDTH);

	useEffect(() => {
		if (!isCollapsed) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [isCollapsed]);

	if (isCollapsed) {
		return (
			<aside className="w-12 md:w-12 border-r border-border bg-background flex flex-col transition-all duration-300 ease-in-out hidden md:flex">
				<div className="h-14 border-b border-border flex items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={onNewSession}
						title="New session"
						className="rounded-full touch-manipulation"
					>
						<Plus className="w-4 h-4" />
					</Button>
				</div>

				<button
					type="button"
					className="flex-1 cursor-pointer hover:bg-muted/50 transition-colors touch-manipulation"
					onClick={!isDiffOpen ? toggleCollapse : undefined}
					title={!isDiffOpen ? 'Expand sidebar' : undefined}
					aria-label="Expand sidebar"
				/>

				<div className="h-12 border-t border-border flex items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleCollapse}
						title="Expand sidebar"
						disabled={isDiffOpen}
						className="transition-transform duration-200 hover:scale-110 touch-manipulation"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</aside>
		);
	}

	return (
		<>
			{!isCollapsed && (
				<div
					className="fixed inset-0 bg-black/50 z-40 md:hidden"
					onClick={toggleCollapse}
					aria-hidden="true"
				/>
			)}
			<aside
				className="border-r border-border bg-background flex transition-all duration-300 ease-in-out fixed md:relative top-0 left-0 z-50 h-screen md:h-auto w-full md:w-auto"
				style={{ maxWidth: '100%' }}
			>
				<div className="flex-1 flex flex-col min-w-0" style={{ width: panelWidth }}>
					<div className="h-14 border-b border-border px-4 flex items-center gap-2 md:hidden bg-background">
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleCollapse}
							title="Close menu"
							className="touch-manipulation flex-shrink-0"
							aria-label="Close menu"
						>
							<X className="w-5 h-5" />
						</Button>
						<h1 className="text-lg font-semibold text-foreground flex-1">otto</h1>
					</div>

					<div className="h-14 border-b border-border px-4 flex items-center gap-2">
						<Button
							variant="primary"
							size="sm"
							onClick={onNewSession}
							className="flex-1 touch-manipulation"
						>
							<Plus className="w-4 h-4 mr-2" />
							New Session
						</Button>
					</div>

					<div className="flex-1 overflow-y-auto scrollbar-hide">{children}</div>

					<div className="h-12 border-t border-border px-2 flex items-center justify-end">
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleCollapse}
							title="Collapse sidebar"
							disabled={isDiffOpen}
							className="transition-transform duration-200 hover:scale-110 touch-manipulation"
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
				</div>
				<div className="hidden md:block">
					<ResizeHandle panelKey={PANEL_KEY} side="left" minWidth={MIN_WIDTH} maxWidth={MAX_WIDTH} defaultWidth={DEFAULT_WIDTH} />
				</div>
			</aside>
		</>
	);
});
