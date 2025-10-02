import type { ReactNode } from 'react';

interface SidebarProps {
	children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
	return (
		<aside className="w-64 border-r border-border bg-background flex flex-col">
			<div className="p-4 border-b border-border">
				<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Sessions
				</h2>
			</div>
			<div className="flex-1 overflow-y-auto">{children}</div>
		</aside>
	);
}
