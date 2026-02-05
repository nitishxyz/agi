import { memo } from 'react';
import { Plus, X, Bot, User } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import type { Terminal } from '../../hooks/useTerminals';

interface TerminalTabBarProps {
	terminals: Terminal[];
	onNewTerminal: () => void;
	onKillTerminal: (id: string) => void;
	isCreating?: boolean;
}

export const TerminalTabBar = memo(function TerminalTabBar({
	terminals,
	onNewTerminal,
	onKillTerminal,
	isCreating,
}: TerminalTabBarProps) {
	const activeTabId = useTerminalStore((s) => s.activeTabId);
	const selectTab = useTerminalStore((s) => s.selectTab);

	return (
		<div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
			{terminals.map((t) => {
				const isActive = t.id === activeTabId;
				const isRunning = t.status === 'running';

				return (
					<div
						key={t.id}
						className={`group flex items-center gap-1.5 px-3 h-9 border-r border-border cursor-pointer select-none shrink-0 transition-colors ${
							isActive
								? 'bg-background text-foreground'
								: 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
						}`}
						onClick={() => selectTab(t.id)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') selectTab(t.id);
						}}
						role="tab"
						aria-selected={isActive}
						tabIndex={0}
					>
						<span className="shrink-0">
							{t.createdBy === 'llm' ? (
								<Bot className="w-3 h-3 text-blue-500" />
							) : (
								<User className="w-3 h-3 text-green-500" />
							)}
						</span>
						<span className="text-xs font-medium truncate max-w-[120px]">
							{t.title || t.purpose}
						</span>
						{!isRunning && (
							<span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
						)}
						<button
							type="button"
							className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
							onClick={(e) => {
								e.stopPropagation();
								onKillTerminal(t.id);
							}}
							title="Close terminal"
						>
							<X className="w-3 h-3" />
						</button>
					</div>
				);
			})}
			<button
				type="button"
				className="flex items-center justify-center w-8 h-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
				onClick={onNewTerminal}
				disabled={isCreating}
				title="New terminal"
			>
				<Plus className="w-3.5 h-3.5" />
			</button>
		</div>
	);
});
