import { useHotkeys } from '@tanstack/react-hotkeys';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

export function useCanvasKeybinds() {
	const addBlock = useCanvasStore((s) => s.addBlock);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const focusNext = useCanvasStore((s) => s.focusNext);
	const focusPrev = useCanvasStore((s) => s.focusPrev);
	const focusByIndex = useCanvasStore((s) => s.focusByIndex);
	const focusDirection = useCanvasStore((s) => s.focusDirection);
	const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

	useHotkeys([
		{ hotkey: 'Mod+N', callback: () => addBlock('pending') },
		{ hotkey: 'Mod+D', callback: () => addBlock('pending', undefined, 'horizontal') },
		{ hotkey: 'Mod+Shift+D', callback: () => addBlock('pending', undefined, 'vertical') },

		{ hotkey: 'Mod+W', callback: () => { if (focusedBlockId) removeBlock(focusedBlockId); } },

		{ hotkey: 'Mod+]', callback: () => focusNext() },
		{ hotkey: 'Mod+[', callback: () => focusPrev() },

		{ hotkey: 'Mod+1', callback: () => focusByIndex(0) },
		{ hotkey: 'Mod+2', callback: () => focusByIndex(1) },
		{ hotkey: 'Mod+3', callback: () => focusByIndex(2) },
		{ hotkey: 'Mod+4', callback: () => focusByIndex(3) },
		{ hotkey: 'Mod+5', callback: () => focusByIndex(4) },
		{ hotkey: 'Mod+6', callback: () => focusByIndex(5) },
		{ hotkey: 'Mod+7', callback: () => focusByIndex(6) },
		{ hotkey: 'Mod+8', callback: () => focusByIndex(7) },
		{ hotkey: 'Mod+9', callback: () => focusByIndex(8) },

		{ hotkey: 'Control+H', callback: () => focusDirection('left') },
		{ hotkey: 'Control+L', callback: () => focusDirection('right') },
		{ hotkey: 'Control+K', callback: () => focusDirection('up') },
		{ hotkey: 'Control+J', callback: () => focusDirection('down') },

		{ hotkey: 'Mod+Shift+B', callback: () => toggleSidebar() },
	]);
}
