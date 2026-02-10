import { getCurrentWindow } from '@tauri-apps/api/window';

export const handleTitleBarDrag = (e: React.MouseEvent) => {
	const target = e.target as HTMLElement;
	const isInteractive = target.closest('button, a, input, [role="button"]');
	if (e.buttons === 1 && !isInteractive) {
		getCurrentWindow().startDragging();
	}
};
