import type { LayoutNode } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { BlockFrame } from './BlockFrame';
import { useCallback, useRef } from 'react';

interface LayoutProps {
	node: LayoutNode;
}

function SplitPane({ node }: { node: LayoutNode & { kind: 'split' } }) {
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
		[node.id, node.direction, setSplitRatio],
	);

	const isH = node.direction === 'horizontal';

	return (
		<div
			ref={containerRef}
			className={`flex h-full w-full ${isH ? 'flex-row' : 'flex-col'}`}
		>
			<div style={{ [isH ? 'width' : 'height']: `${node.ratio * 100}%` }} className="min-w-0 min-h-0">
				<LayoutRenderer node={node.first} />
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
				<LayoutRenderer node={node.second} />
			</div>
		</div>
	);
}

function LayoutRenderer({ node }: LayoutProps) {
	const blocks = useCanvasStore((s) => s.blocks);

	if (node.kind === 'leaf') {
		const block = blocks[node.blockId];
		if (!block) return null;
		return (
			<div className="h-full w-full p-0.5">
				<BlockFrame block={block} />
			</div>
		);
	}

	return <SplitPane node={node} />;
}

export function CanvasRenderer() {
	const layout = useCanvasStore((s) => s.layout);

	if (!layout) {
		return (
			<div className="flex-1 flex items-center justify-center h-full">
				<div className="text-center space-y-3">
					<p className="text-[13px] text-canvas-text-dim">No blocks yet</p>
					<p className="text-[11px] text-canvas-text-muted">
						Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-canvas-text-dim text-[10px]">Ctrl+Shift+N</kbd> to add a block
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 h-full p-1">
			<LayoutRenderer node={layout} />
		</div>
	);
}
