import { memo, useCallback, useRef, useEffect } from 'react';
import {
	Terminal as TerminalIcon,
	Maximize2,
	Minimize2,
	ChevronDown,
} from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import {
	useTerminals,
	useCreateTerminal,
	useKillTerminal,
} from '../../hooks/useTerminals';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalViewer } from './TerminalViewer';

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.85;

export const TerminalsPanel = memo(function TerminalsPanel() {
	const isOpen = useTerminalStore((s) => s.isOpen);
	const panelHeight = useTerminalStore((s) => s.panelHeight);
	const setPanelHeight = useTerminalStore((s) => s.setPanelHeight);
	const activeTabId = useTerminalStore((s) => s.activeTabId);
	const selectTab = useTerminalStore((s) => s.selectTab);
	const closePanel = useTerminalStore((s) => s.closePanel);
	const isMaximized = useTerminalStore((s) => s.isMaximized);
	const toggleMaximize = useTerminalStore((s) => s.toggleMaximize);
	const togglePanel = useTerminalStore((s) => s.togglePanel);

	const { data: terminals } = useTerminals();
	const createTerminal = useCreateTerminal();
	const killTerminal = useKillTerminal();

	const dragRef = useRef<{
		startY: number;
		startHeight: number;
	} | null>(null);

	const terminalsList = terminals?.terminals ?? [];

	const autoCreatingRef = useRef(false);
	const terminalsListRef = useRef(terminalsList);
	terminalsListRef.current = terminalsList;

	useEffect(() => {
		if (
			isOpen &&
			terminalsListRef.current.length > 0 &&
			(!activeTabId || !terminalsListRef.current.find((t) => t.id === activeTabId))
		) {
			selectTab(terminalsListRef.current[0].id);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, terminalsList.length, activeTabId, selectTab]);

	useEffect(() => {
		if (
			isOpen &&
			terminals &&
			terminalsList.length === 0 &&
			!autoCreatingRef.current &&
			!createTerminal.isPending
		) {
			autoCreatingRef.current = true;
			createTerminal.mutateAsync({
					command: 'bash',
					purpose: 'Manual shell',
				})
				.then((result) => {
					selectTab(result.terminalId);
				})
				.catch(() => {})
				.finally(() => {
					autoCreatingRef.current = false;
				});
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, terminals, terminalsList.length, selectTab]);

	const handleNewTerminal = useCallback(async () => {
		try {
			const result = await createTerminal.mutateAsync({
				command: 'bash',
				purpose: 'Manual shell',
			});
			selectTab(result.terminalId);
		} catch {
			// ignore
		}
	}, [createTerminal, selectTab]);

	const handleKillTerminal = useCallback(
		async (id: string) => {
			try {
				await killTerminal.mutateAsync(id);
				if (activeTabId === id) {
					const remaining = terminalsListRef.current.filter((t) => t.id !== id);
					if (remaining.length > 0) {
						selectTab(remaining[0].id);
					} else {
						selectTab(null);
						closePanel();
					}
				}
			} catch {
				// ignore
			}
		},
		[killTerminal, activeTabId, selectTab, closePanel],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === '`' && e.ctrlKey) {
				e.preventDefault();
				togglePanel();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [togglePanel]);

	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			dragRef.current = {
				startY: e.clientY,
				startHeight: panelHeight,
			};

			const handleMouseMove = (ev: MouseEvent) => {
				if (!dragRef.current) return;
				const delta = dragRef.current.startY - ev.clientY;
				const newHeight = dragRef.current.startHeight + delta;
				const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
				setPanelHeight(Math.min(Math.max(MIN_HEIGHT, newHeight), maxH));
			};

			const handleMouseUp = () => {
				dragRef.current = null;
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		},
		[panelHeight, setPanelHeight],
	);

	if (!isOpen) return null;

	const height = isMaximized ? '100%' : `${panelHeight}px`;

	return (
		<div
			className="border-t border-border bg-background flex flex-col shrink-0"
			style={{ height, minHeight: MIN_HEIGHT }}
		>
			{!isMaximized && (
				// biome-ignore lint/a11y/noStaticElementInteractions: mouse-only resize handle
				<div
					className="h-1 cursor-row-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0"
					onMouseDown={handleResizeStart}
				/>
			)}

			<div className="h-9 border-b border-border flex items-center shrink-0">
				<div className="flex items-center gap-1.5 px-3 shrink-0 border-r border-border h-full">
					<TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
					<span className="text-xs font-medium text-muted-foreground">
						Terminal
					</span>
					{terminalsList.length > 0 && (
						<span className="text-[10px] text-muted-foreground/70">
							({terminalsList.length})
						</span>
					)}
				</div>

				<TerminalTabBar
					terminals={terminalsList}
					onNewTerminal={handleNewTerminal}
					onKillTerminal={handleKillTerminal}
					isCreating={createTerminal.isPending}
				/>

				<div className="ml-auto flex items-center gap-0.5 px-2 shrink-0">
					<button
						type="button"
						className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						onClick={toggleMaximize}
						title={isMaximized ? 'Restore' : 'Maximize'}
					>
						{isMaximized ? (
							<Minimize2 className="w-3.5 h-3.5" />
						) : (
							<Maximize2 className="w-3.5 h-3.5" />
						)}
					</button>
					<button
						type="button"
						className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						onClick={closePanel}
						title="Close panel"
					>
						<ChevronDown className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-hidden">
				{activeTabId ? (
					<TerminalViewer
						terminalId={activeTabId}
						onExit={handleKillTerminal}
					/>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<TerminalIcon className="w-8 h-8 mb-2 opacity-40" />
						<div className="text-xs">
							{terminalsList.length === 0
								? 'No terminals running'
								: 'Select a terminal tab'}
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
