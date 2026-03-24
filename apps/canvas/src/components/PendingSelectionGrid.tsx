import type { ReactNode } from 'react';

export interface PendingSelectionOption<TValue extends string> {
	key: string;
	value: TValue;
	label: string;
	renderIcon: () => ReactNode;
}

interface PendingSelectionGridProps<TValue extends string> {
	options: PendingSelectionOption<TValue>[];
	onSelect: (value: TValue) => void;
}

/**
 * Shared centered picker used by pending blocks and pending tabs.
 */
export function PendingSelectionGrid<TValue extends string>({
	options,
	onSelect,
}: PendingSelectionGridProps<TValue>) {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-center gap-3">
					{options.map((option) => (
						<button
							key={option.value}
							onClick={() => onSelect(option.value)}
							className="flex min-w-[124px] flex-col items-center gap-2 rounded-xl px-5 py-4 transition-colors hover:bg-white/[0.06] group"
						>
							<div className="text-canvas-text-muted transition-colors group-hover:text-canvas-text-dim">
								{option.renderIcon()}
							</div>
							<span className="text-[11px] text-canvas-text-muted transition-colors group-hover:text-canvas-text-dim">
								{option.label}
							</span>
							<kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-canvas-text-muted">
								{option.key}
							</kbd>
						</button>
					))}
				</div>
				<p className="text-center text-[10px] text-canvas-text-muted">
					press number to select · esc to cancel
				</p>
			</div>
		</div>
	);
}
