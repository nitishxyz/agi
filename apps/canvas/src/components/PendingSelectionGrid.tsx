import type { ReactNode } from 'react';

export interface PendingSelectionOption<TValue> {
	key: string;
	value: TValue;
	label: string;
	description?: string;
	renderIcon: () => ReactNode;
}

interface PendingSelectionGridProps<TValue> {
	title: string;
	subtitle?: string;
	options: PendingSelectionOption<TValue>[];
	onSelect: (value: TValue) => void;
}

export function PendingSelectionGrid<TValue>({
	options,
	onSelect,
}: PendingSelectionGridProps<TValue>) {
	return (
		<div className="flex h-full w-full flex-1 items-center justify-center overflow-auto p-4">
			<div className="flex flex-col items-center gap-6">
				<div className="grid grid-cols-5 gap-1.5">
					{options.map((option) => (
						<button
							type="button"
							key={`${option.key}-${option.label}`}
							onClick={() => onSelect(option.value)}
							className="group relative flex w-[110px] flex-col items-center gap-2 rounded-xl px-2 pb-3 pt-4 transition-all hover:bg-white/[0.06]"
						>
							<kbd className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] px-1 text-[9px] leading-none text-canvas-text-muted/60">
								{option.key}
							</kbd>
							<div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/[0.10] bg-white/[0.05] text-canvas-text-muted transition-colors group-hover:border-white/[0.16] group-hover:bg-white/[0.08] group-hover:text-canvas-text-dim">
								{option.renderIcon()}
							</div>
							<span className="w-full text-center text-[11px] leading-tight text-canvas-text-muted transition-colors group-hover:text-canvas-text-dim">
								{option.label}
							</span>
						</button>
					))}
				</div>
				<p className="text-[10px] text-canvas-text-muted/50">
					press number to select · esc to cancel
				</p>
			</div>
		</div>
	);
}
