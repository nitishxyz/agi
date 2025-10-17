import { memo } from 'react';
import { Terminal, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTerminalStore } from '../../stores/terminalStore';
import { useTerminals, useCreateTerminal } from '../../hooks/useTerminals';
import { TerminalList } from './TerminalList';
import { TerminalViewer } from './TerminalViewer';

export const TerminalsSidebar = memo(function TerminalsSidebar() {
	const isExpanded = useTerminalStore((state) => state.isExpanded);
	const collapseSidebar = useTerminalStore((state) => state.collapseSidebar);
	const selectedTerminalId = useTerminalStore(
		(state) => state.selectedTerminalId,
	);
	const selectTerminal = useTerminalStore((state) => state.selectTerminal);
	const expandSidebar = useTerminalStore((state) => state.expandSidebar);

	const { data: terminals, isLoading } = useTerminals();
	const createTerminal = useCreateTerminal();

	const handleNewTerminal = async () => {
		try {
			const result = await createTerminal.mutateAsync({
				command: 'bash',
				purpose: 'Manual shell',
			});

			selectTerminal(result.terminalId);
			expandSidebar();
		} catch (error) {
			console.error('Failed to create terminal:', error);
		}
	};

	if (!isExpanded) return null;

	return (
		<div className="w-80 border-l border-border bg-background flex flex-col h-full">
			<div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<Terminal className="w-4 h-4" />
					<span className="font-medium">Terminals</span>
					{terminals && terminals.count > 0 && (
						<span className="text-xs text-muted-foreground">
							({terminals.count})
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleNewTerminal}
						title="New terminal"
						disabled={createTerminal.isPending}
					>
						<Plus className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="icon" onClick={collapseSidebar}>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-hidden flex flex-col">
				{selectedTerminalId ? (
					<TerminalViewer terminalId={selectedTerminalId} />
				) : (
					<TerminalList
						terminals={terminals?.terminals ?? []}
						isLoading={isLoading}
					/>
				)}
			</div>
		</div>
	);
});
