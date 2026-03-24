import { Bot, Globe, Terminal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Block, LayoutNode, WorkspaceTabKind, WorkspaceTabState } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { BlockFrame } from './BlockFrame';
import { PendingSelectionGrid } from './PendingSelectionGrid';

interface LayoutProps {
	node: LayoutNode;
	blocks: Record<string, Block>;
	activeTabKind: 'canvas' | 'block' | 'pending' | null;
}

const TAB_OPTIONS: {
	kind: WorkspaceTabKind;
	label: string;
	description: string;
	renderIcon: () => ReactNode;
	shortcut: string;
}[] = [
	{
		kind: 'canvas',
		label: 'Canvas',
		description: 'A multi-block surface for split layouts.',
		renderIcon: () => <span className="text-[15px] leading-none">▣</span>,
		shortcut: '1',
	},
	{
		kind: 'terminal',
		label: 'Ghostty',
		description: 'A focused terminal or command surface.',
		renderIcon: () => <Terminal size={16} strokeWidth={1.75} />,
		shortcut: '2',
	},
	{
		kind: 'browser',
		label: 'Browser',
		description: 'A full browser preview or docs tab.',
		renderIcon: () => <Globe size={16} strokeWidth={1.75} />,
		shortcut: '3',
	},
	{
		kind: 'otto',
		label: 'Otto',
		description: 'A focused Otto block as its own tab.',
		renderIcon: () => <Bot size={16} strokeWidth={1.75} />,
		shortcut: '4',
	},
];

function SplitPane({
	node,
	blocks,
	activeTabKind,
}: {
	node: LayoutNode & { kind: 'split' };
	blocks: Record<string, Block>;
	activeTabKind: 'canvas' | 'block' | 'pending' | null;
}) {
	const setSplitRatio = useCanvasStore((s) => s.setSplitRatio);
	const containerRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			draggingRef.current = true;

			const onMouseMove = (ev: MouseEvent) => {
				if (!draggingRef.current || !containerRef.current) return;
				const rect = containerRef.current.getBoundingClientRect();
				let ratio: number;
				if (node.direction === 'horizontal') {
					ratio = (ev.clientX - rect.left) / rect.width;
				} else {
					ratio = (ev.clientY - rect.top) / rect.height;
				}
				setSplitRatio(node.id, Math.max(0.15, Math.min(0.85, ratio)));
			};

			const onMouseUp = () => {
				draggingRef.current = false;
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		},
		[node.direction, node.id, setSplitRatio],
	);

	const isH = node.direction === 'horizontal';

	return (
		<div
			ref={containerRef}
			className={`flex h-full w-full ${isH ? 'flex-row' : 'flex-col'}`}
		>
			<div style={{ [isH ? 'width' : 'height']: `${node.ratio * 100}%` }} className="min-w-0 min-h-0">
				<LayoutRenderer node={node.first} blocks={blocks} activeTabKind={activeTabKind} />
			</div>
			<div
				className={`flex-shrink-0 ${
					isH
						? 'w-[3px] cursor-col-resize hover:bg-canvas-accent/30'
						: 'h-[3px] cursor-row-resize hover:bg-canvas-accent/30'
				} transition-colors duration-100`}
				onMouseDown={handleMouseDown}
			/>
			<div style={{ [isH ? 'width' : 'height']: `${(1 - node.ratio) * 100}%` }} className="min-w-0 min-h-0">
				<LayoutRenderer node={node.second} blocks={blocks} activeTabKind={activeTabKind} />
			</div>
		</div>
	);
}

function LayoutRenderer({ node, blocks, activeTabKind }: LayoutProps) {
	if (node.kind === 'leaf') {
		const block = blocks[node.blockId];
		if (!block) return null;
		return (
			<div className={`h-full w-full ${activeTabKind === 'block' ? '' : 'p-0.5'}`}>
				<BlockFrame block={block} />
			</div>
		);
	}

	return <SplitPane node={node} blocks={blocks} activeTabKind={activeTabKind} />;
}

function PendingTabSurface({ isActive }: { isActive: boolean }) {
	const createTab = useCanvasStore((s) => s.createTab);
	const surfaceRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isActive) return;
		window.setTimeout(() => {
			window.focus();
			surfaceRef.current?.focus();
		}, 0);
	}, [isActive]);

	return (
		<div
			ref={surfaceRef}
			tabIndex={isActive ? 0 : -1}
			className="flex h-full w-full rounded-lg border border-dashed border-canvas-border-active bg-[rgba(22,22,26,0.9)] outline-none"
		>
			<PendingSelectionGrid
				options={TAB_OPTIONS.map((option) => ({
					key: option.shortcut,
					value: option.kind,
					label: option.label,
					renderIcon: option.renderIcon,
				}))}
				onSelect={(kind) => createTab(kind)}
			/>
		</div>
	);
}

function TabSurface({
	tab,
	isActive,
}: {
	tab: WorkspaceTabState;
	isActive: boolean;
}) {
	const emptyStateRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isActive || tab.kind !== 'canvas' || tab.layout) return;
		window.setTimeout(() => {
			window.focus();
			emptyStateRef.current?.focus();
		}, 0);
	}, [isActive, tab]);

	if (tab.kind === 'pending') {
		return <PendingTabSurface isActive={isActive} />;
	}

	if (tab.kind === 'block') {
		return (
			<div className="flex-1 h-full">
				<div className="h-full w-full">
					<BlockFrame block={tab.block} />
				</div>
			</div>
		);
	}

	if (!tab.layout) {
		return (
			<div
				ref={emptyStateRef}
				tabIndex={isActive ? 0 : -1}
				className="flex h-full flex-1 items-center justify-center outline-none"
			>
				<div className="space-y-3 text-center">
					<p className="text-[13px] text-canvas-text-dim">No blocks yet</p>
					<p className="text-[11px] text-canvas-text-muted">
						Press <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-canvas-text-dim">⌘N</kbd> to add a block
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 h-full p-1">
			<LayoutRenderer node={tab.layout} blocks={tab.blocks} activeTabKind="canvas" />
		</div>
	);
}

export function CanvasRenderer() {
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
	const workspaceState = useCanvasStore((s) =>
		activeWorkspaceId ? s.workspaceStates[activeWorkspaceId] ?? null : null,
	);
	const effectiveActiveTabId = useMemo(() => {
		if (!workspaceState) return null;
		if (
			workspaceState.activeTabId &&
			workspaceState.tabs[workspaceState.activeTabId]
		) {
			return workspaceState.activeTabId;
		}
		return workspaceState.tabOrder.find((tabId) => workspaceState.tabs[tabId]) ?? null;
	}, [workspaceState]);
	const orderedTabs = useMemo(
		() =>
			workspaceState?.tabOrder
				.map((tabId) => workspaceState.tabs[tabId])
				.filter((tab): tab is WorkspaceTabState => Boolean(tab)) ?? [],
		[workspaceState],
	);

	if (!activeWorkspaceId || !workspaceState) {
		return (
			<div className="flex h-full flex-1 items-center justify-center outline-none">
				<div className="space-y-3 text-center">
					<p className="text-[13px] text-canvas-text-dim">No workspace open</p>
					<p className="max-w-sm text-[11px] text-canvas-text-muted">
						Use the + button in the sidebar to create a workspace linked to a local project path.
					</p>
				</div>
			</div>
		);
	}

	if (orderedTabs.length === 0) {
		return (
			<div className="flex h-full flex-1 items-center justify-center outline-none">
				<div className="space-y-3 text-center">
					<p className="text-[13px] text-canvas-text-dim">No tabs yet</p>
					<p className="text-[11px] text-canvas-text-muted">
						Press <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-canvas-text-dim">⌘T</kbd> to create a tab
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative flex-1 h-full overflow-hidden">
			{orderedTabs.map((tab) => {
				const isActive = tab.id === effectiveActiveTabId;
				return (
					<div
						key={tab.id}
						data-workspace-tab-id={tab.id}
						className={
							isActive
								? 'relative h-full w-full'
								: 'pointer-events-none absolute inset-0 opacity-0'
						}
						aria-hidden={!isActive}
					>
						<TabSurface tab={tab} isActive={isActive} />
					</div>
				);
			})}
		</div>
	);
}
