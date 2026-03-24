import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useEffect, useRef } from 'react';
import { X, Terminal, Globe, Bot } from 'lucide-react';
import type { Block, BlockType } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { BrowserBlock } from './BrowserBlock';
import { GhosttyBlock } from './GhosttyBlock';
import { OttoBlock } from './OttoBlock';
import { PendingSelectionGrid } from './PendingSelectionGrid';

const BLOCK_ICONS = {
	terminal: Terminal,
	browser: Globe,
	otto: Bot,
} as const;

const PICKER_OPTIONS: { key: string; type: BlockType; label: string; icon: typeof Terminal }[] = [
	{ key: '1', type: 'terminal', label: 'Ghostty', icon: Terminal },
	{ key: '2', type: 'browser', label: 'Browser', icon: Globe },
	{ key: '3', type: 'otto', label: 'Otto', icon: Bot },
];

interface BlockFrameProps {
	block: Block;
}

function PendingPicker({ blockId }: { blockId: string }) {
	const convertBlock = useCanvasStore((s) => s.convertBlock);

	return (
		<PendingSelectionGrid
			options={PICKER_OPTIONS.map(({ key, type, label, icon: Icon }) => ({
				key,
				value: type,
				label,
				renderIcon: () => (
					<Icon
						size={22}
						className="text-canvas-text-muted transition-colors group-hover:text-canvas-text-dim"
						strokeWidth={1.5}
					/>
				),
			}))}
			onSelect={(type) => convertBlock(blockId, type)}
		/>
	);
}

function renderBlockContent(block: Block, isFocused: boolean) {
	switch (block.type) {
		case 'terminal':
			return <GhosttyBlock block={block} isFocused={isFocused} />;
		case 'browser':
			return <BrowserBlock block={block} />;
		case 'otto':
			return <OttoBlock block={block} isFocused={isFocused} />;
		default:
			return null;
	}
}

export function BlockFrame({ block }: BlockFrameProps) {
	const { focusedBlockId, setFocused, removeBlock } = useCanvasStore();
	const isFocused = focusedBlockId === block.id;
	const isPending = block.type === 'pending';
	const pendingRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isPending && isFocused) {
			window.setTimeout(() => {
				void getCurrentWebview().setFocus().catch(() => undefined);
				pendingRef.current?.focus();
				window.focus();
			}, 0);
		}
	}, [isFocused, isPending]);

	if (isPending) {
		return (
			<div
				ref={pendingRef}
				tabIndex={0}
				className={`flex flex-col h-full rounded-lg overflow-hidden border border-dashed outline-none ${
					isFocused ? 'border-canvas-border-active' : 'border-canvas-border'
				}`}
				style={{ background: 'rgba(22, 22, 26, 0.9)' }}
				onClick={() => setFocused(block.id)}
			>
				<PendingPicker blockId={block.id} />
			</div>
		);
	}

	const Icon = BLOCK_ICONS[block.type as keyof typeof BLOCK_ICONS];

	return (
		<div
			className={`flex flex-col h-full rounded-lg overflow-hidden border transition-colors duration-150 ${
				isFocused
					? 'border-canvas-border-active shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
					: 'border-canvas-border'
			}`}
			onClick={() => setFocused(block.id)}
		>
			<div
				className="flex items-center justify-between h-8 px-3 border-b border-canvas-border flex-shrink-0"
				style={{ background: 'rgba(22, 22, 26, 0.9)' }}
			>
				<div className="flex items-center gap-2">
					<Icon size={12} className="text-canvas-text-muted" />
					<span className="text-[11px] font-medium text-canvas-text-dim">
						{block.label}
					</span>
				</div>
				<button
					onClick={(e) => {
						e.stopPropagation();
						removeBlock(block.id);
					}}
					className="p-0.5 rounded text-canvas-text-muted hover:text-canvas-text-dim hover:bg-white/[0.06] transition-colors"
				>
					<X size={10} />
				</button>
			</div>

			<div className="flex-1 min-h-0">{renderBlockContent(block, isFocused)}</div>
		</div>
	);
}
