import { useEffect, useRef } from 'react';
import { Terminal, Globe, Bot, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import type { BlockType, SplitDirection } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
}

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: typeof Terminal }[] = [
	{ type: 'terminal', label: 'Terminal', icon: Terminal },
	{ type: 'browser', label: 'Browser', icon: Globe },
	{ type: 'otto', label: 'Otto', icon: Bot },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
	const addBlock = useCanvasStore((s) => s.addBlock);
	const hasBlocks = useCanvasStore((s) => s.layout !== null);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [open, onClose]);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onClose();
			}
		};
		window.addEventListener('mousedown', handler);
		return () => window.removeEventListener('mousedown', handler);
	}, [open, onClose]);

	if (!open) return null;

	const handleAdd = (type: BlockType, direction?: SplitDirection) => {
		addBlock(type, undefined, direction);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
			<div className="absolute inset-0 bg-black/40" />
			<div
				ref={ref}
				className="relative w-[340px] rounded-xl border border-canvas-border overflow-hidden"
				style={{ backdropFilter: 'blur(24px)', background: 'rgba(22, 22, 26, 0.95)' }}
			>
				<div className="px-4 py-3 border-b border-canvas-border">
					<p className="text-[11px] font-semibold tracking-wider text-canvas-text-muted uppercase">
						Add block
					</p>
				</div>
				<div className="p-2 space-y-0.5">
					{BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
						<div key={type} className="flex items-center gap-1">
							<button
								onClick={() => handleAdd(type)}
								className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-left text-canvas-text-dim hover:text-canvas-text hover:bg-white/[0.06] transition-colors duration-100"
							>
								<Icon size={14} />
								<span className="text-[12px] font-medium">{label}</span>
							</button>
							{hasBlocks && (
								<div className="flex items-center gap-0.5">
									<button
										onClick={() => handleAdd(type, 'horizontal')}
										className="p-1.5 rounded-md text-canvas-text-muted hover:text-canvas-text-dim hover:bg-white/[0.06] transition-colors"
										title="Split right"
									>
										<SplitSquareHorizontal size={13} />
									</button>
									<button
										onClick={() => handleAdd(type, 'vertical')}
										className="p-1.5 rounded-md text-canvas-text-muted hover:text-canvas-text-dim hover:bg-white/[0.06] transition-colors"
										title="Split down"
									>
										<SplitSquareVertical size={13} />
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
