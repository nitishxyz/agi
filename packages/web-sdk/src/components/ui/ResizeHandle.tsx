import { memo, useCallback, useRef } from 'react';
import { usePanelWidthStore } from '../../stores/panelWidthStore';

interface ResizeHandleProps {
	panelKey: string;
	side: 'left' | 'right';
	minWidth: number;
	maxWidth: number;
	defaultWidth: number;
	onWidthChange?: (width: number) => void;
}

export const ResizeHandle = memo(function ResizeHandle({
	panelKey,
	side,
	minWidth,
	maxWidth,
	defaultWidth,
	onWidthChange,
}: ResizeHandleProps) {
	const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const currentWidth = usePanelWidthStore
				.getState()
				.getWidth(panelKey, defaultWidth);
			dragRef.current = { startX: e.clientX, startWidth: currentWidth };

			const handleMouseMove = (ev: MouseEvent) => {
				if (!dragRef.current) return;
				const delta = ev.clientX - dragRef.current.startX;
				const newWidth =
					side === 'right'
						? dragRef.current.startWidth - delta
						: dragRef.current.startWidth + delta;
				const clamped = Math.min(Math.max(minWidth, newWidth), maxWidth);
				usePanelWidthStore.getState().setWidth(panelKey, clamped);
				onWidthChange?.(clamped);
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
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		},
		[panelKey, side, minWidth, maxWidth, defaultWidth, onWidthChange],
	);

	return (
		<div
			className={`w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0 ${
				side === 'right' ? 'order-first' : 'order-last'
			}`}
			onMouseDown={handleMouseDown}
		/>
	);
});
