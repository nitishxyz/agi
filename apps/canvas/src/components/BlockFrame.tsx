import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
	BLOCK_PRIMITIVE_OPTIONS,
	getCommandSurfaceDefinition,
	getPrimitiveDefinition,
} from '../lib/primitive-registry';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { BrowserBlock } from './BrowserBlock';
import { CommandBlock } from './CommandBlock';
import { GhosttyBlock } from './GhosttyBlock';
import { OttoBlock } from './OttoBlock';
import { PendingSelectionGrid } from './PendingSelectionGrid';

interface BlockFrameProps {
	block: Block;
}

function PendingPicker({ blockId }: { blockId: string }) {
	const convertBlock = useCanvasStore((s) => s.convertBlock);
	const convertBlockToPreset = useCanvasStore((s) => s.convertBlockToPreset);

	return (
		<PendingSelectionGrid
			options={BLOCK_PRIMITIVE_OPTIONS.map(({ key, value, label, icon: Icon }) => ({
				key,
				value,
				label,
				renderIcon: () => (
					<Icon
						size={22}
						className="text-canvas-text-muted transition-colors group-hover:text-canvas-text-dim"
						strokeWidth={1.5}
					/>
				),
			}))}
			onSelect={(value) => {
				if (value.kind === 'primitive') {
					convertBlock(blockId, value.primitive);
					return;
				}
				convertBlockToPreset(blockId, value.preset);
			}}
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
		case 'command':
			return <CommandBlock block={block} isFocused={isFocused} />;
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

	const Icon =
		block.type === 'command'
			? getCommandSurfaceDefinition(block.presetId).icon
			: getPrimitiveDefinition(block.type as Exclude<Block['type'], 'pending'>).icon;

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
