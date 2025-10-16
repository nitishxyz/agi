import { Button } from '../ui/Button';
import { memo } from 'react';
import { Terminal as TerminalIcon, User, Bot } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import type { Terminal } from '../../hooks/useTerminals';

interface TerminalListProps {
	terminals: Terminal[];
	isLoading: boolean;
}

export const TerminalList = memo(function TerminalList({
	terminals,
	isLoading,
}: TerminalListProps) {
	const selectTerminal = useTerminalStore((state) => state.selectTerminal);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				<div className="text-sm">Loading terminals...</div>
			</div>
		);
	}

	if (terminals.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
				<TerminalIcon className="w-12 h-12 mb-3 opacity-50" />
				<div className="text-sm font-medium mb-1">No active terminals</div>
				<div className="text-xs">
					Click the + button to create a new terminal
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="p-2 space-y-1">
				{terminals.map((terminal) => (
					<Button
						key={terminal.id}
						variant="ghost"
						className="w-full justify-start h-auto py-3 px-3"
						onClick={() => selectTerminal(terminal.id)}
					>
						<div className="flex items-start gap-3 w-full">
							<div className="shrink-0 mt-0.5">
								{terminal.createdBy === 'llm' ? (
									<Bot className="w-4 h-4 text-blue-500" />
								) : (
									<User className="w-4 h-4 text-green-500" />
								)}
							</div>
							<div className="flex-1 min-w-0 text-left">
								<div className="text-sm font-medium truncate">
									{terminal.title}
								</div>
								<div className="text-xs text-muted-foreground truncate">
									{terminal.command}{' '}
									{terminal.args.length > 0 && terminal.args.join(' ')}
								</div>
								<div className="flex items-center gap-2 mt-1">
									<span
										className={`text-xs ${
											terminal.status === 'running'
												? 'text-green-600'
												: 'text-orange-600'
										}`}
									>
										{terminal.status === 'running'
											? 'Running'
											: `Exited (${terminal.exitCode})`}
									</span>
									<span className="text-xs text-muted-foreground">
										• {formatUptime(terminal.uptime)}
									</span>
								</div>
							</div>
						</div>
					</Button>
				))}
			</div>
		</div>
	);
});

function formatUptime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m`;
	}
	return `${seconds}s`;
}
