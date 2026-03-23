import { useHotkeys } from '@tanstack/react-hotkeys';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { isTauriRuntime } from '../lib/ghostty';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function shortcutFromEvent(event: KeyboardEvent): string | null {
	if (event.metaKey && !event.altKey) {
		if (event.key.toLowerCase() === 'n') return 'mod+n';
		if (event.key.toLowerCase() === 'd' && event.shiftKey) return 'mod+shift+d';
		if (event.key.toLowerCase() === 'd') return 'mod+d';
		if (event.key.toLowerCase() === 'w') return 'mod+w';
		if (event.key === '[') return 'mod+[';
		if (event.key === ']') return 'mod+]';
		if (/^[1-9]$/.test(event.key)) return `mod+${event.key}`;
		if (event.key.toLowerCase() === 'b' && event.shiftKey) return 'mod+shift+b';
	}

	if (event.ctrlKey && !event.metaKey && !event.altKey) {
		if (event.key.toLowerCase() === 'h') return 'ctrl+h';
		if (event.key.toLowerCase() === 'j') return 'ctrl+j';
		if (event.key.toLowerCase() === 'k') return 'ctrl+k';
		if (event.key.toLowerCase() === 'l') return 'ctrl+l';
	}

	return null;
}

export function useCanvasKeybinds() {
	const addBlock = useCanvasStore((s) => s.addBlock);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const focusNext = useCanvasStore((s) => s.focusNext);
	const focusPrev = useCanvasStore((s) => s.focusPrev);
	const focusByIndex = useCanvasStore((s) => s.focusByIndex);
	const focusDirection = useCanvasStore((s) => s.focusDirection);
	const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
	const lastShortcutAtRef = useRef<Record<string, number>>({});

	const runShortcut = (shortcut: string, callback: () => void) => {
		const now = Date.now();
		const last = lastShortcutAtRef.current[shortcut] ?? 0;
		if (now - last < 250) {
			return;
		}
		lastShortcutAtRef.current[shortcut] = now;
		callback();
	};

	useEffect(() => {
		if (!isTauriRuntime()) {
			return;
		}

		let unlisten: (() => void) | undefined;
		void listen<{ shortcut: string }>('ghostty-native-shortcut', (event) => {
			switch (event.payload.shortcut) {
				case 'mod+n':
					runShortcut('mod+n', () => addBlock('pending'));
					break;
				case 'mod+d':
					runShortcut('mod+d', () => addBlock('pending', undefined, 'horizontal'));
					break;
				case 'mod+shift+d':
					runShortcut('mod+shift+d', () => addBlock('pending', undefined, 'vertical'));
					break;
				case 'mod+w':
					runShortcut('mod+w', () => {
						if (focusedBlockId) removeBlock(focusedBlockId);
					});
					break;
				case 'mod+]':
					runShortcut('mod+]', () => focusNext());
					break;
				case 'mod+[':
					runShortcut('mod+[', () => focusPrev());
					break;
				case 'mod+1':
					runShortcut('mod+1', () => focusByIndex(0));
					break;
				case 'mod+2':
					runShortcut('mod+2', () => focusByIndex(1));
					break;
				case 'mod+3':
					runShortcut('mod+3', () => focusByIndex(2));
					break;
				case 'mod+4':
					runShortcut('mod+4', () => focusByIndex(3));
					break;
				case 'mod+5':
					runShortcut('mod+5', () => focusByIndex(4));
					break;
				case 'mod+6':
					runShortcut('mod+6', () => focusByIndex(5));
					break;
				case 'mod+7':
					runShortcut('mod+7', () => focusByIndex(6));
					break;
				case 'mod+8':
					runShortcut('mod+8', () => focusByIndex(7));
					break;
				case 'mod+9':
					runShortcut('mod+9', () => focusByIndex(8));
					break;
				case 'ctrl+h':
					runShortcut('ctrl+h', () => focusDirection('left'));
					break;
				case 'ctrl+j':
					runShortcut('ctrl+j', () => focusDirection('down'));
					break;
				case 'ctrl+k':
					runShortcut('ctrl+k', () => focusDirection('up'));
					break;
				case 'ctrl+l':
					runShortcut('ctrl+l', () => focusDirection('right'));
					break;
				case 'mod+shift+b':
					runShortcut('mod+shift+b', () => toggleSidebar());
					break;
			}
		}).then((dispose) => {
			unlisten = dispose;
		});

		return () => {
			unlisten?.();
		};
	}, [
		addBlock,
		focusByIndex,
		focusDirection,
		focusNext,
		focusPrev,
		focusedBlockId,
		removeBlock,
		toggleSidebar,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const shortcut = shortcutFromEvent(event);
			if (!shortcut) return;

			event.preventDefault();

			switch (shortcut) {
				case 'mod+n':
					runShortcut('mod+n', () => addBlock('pending'));
					break;
				case 'mod+d':
					runShortcut('mod+d', () => addBlock('pending', undefined, 'horizontal'));
					break;
				case 'mod+shift+d':
					runShortcut('mod+shift+d', () => addBlock('pending', undefined, 'vertical'));
					break;
				case 'mod+w':
					runShortcut('mod+w', () => {
						if (focusedBlockId) removeBlock(focusedBlockId);
					});
					break;
				case 'mod+]':
					runShortcut('mod+]', () => focusNext());
					break;
				case 'mod+[':
					runShortcut('mod+[', () => focusPrev());
					break;
				case 'mod+1':
					runShortcut('mod+1', () => focusByIndex(0));
					break;
				case 'mod+2':
					runShortcut('mod+2', () => focusByIndex(1));
					break;
				case 'mod+3':
					runShortcut('mod+3', () => focusByIndex(2));
					break;
				case 'mod+4':
					runShortcut('mod+4', () => focusByIndex(3));
					break;
				case 'mod+5':
					runShortcut('mod+5', () => focusByIndex(4));
					break;
				case 'mod+6':
					runShortcut('mod+6', () => focusByIndex(5));
					break;
				case 'mod+7':
					runShortcut('mod+7', () => focusByIndex(6));
					break;
				case 'mod+8':
					runShortcut('mod+8', () => focusByIndex(7));
					break;
				case 'mod+9':
					runShortcut('mod+9', () => focusByIndex(8));
					break;
				case 'ctrl+h':
					runShortcut('ctrl+h', () => focusDirection('left'));
					break;
				case 'ctrl+j':
					runShortcut('ctrl+j', () => focusDirection('down'));
					break;
				case 'ctrl+k':
					runShortcut('ctrl+k', () => focusDirection('up'));
					break;
				case 'ctrl+l':
					runShortcut('ctrl+l', () => focusDirection('right'));
					break;
				case 'mod+shift+b':
					runShortcut('mod+shift+b', () => toggleSidebar());
					break;
			}
		};

		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [
		addBlock,
		focusByIndex,
		focusDirection,
		focusNext,
		focusPrev,
		focusedBlockId,
		removeBlock,
		toggleSidebar,
	]);

	useHotkeys([
		{ hotkey: 'Mod+N', callback: () => runShortcut('mod+n', () => addBlock('pending')) },
		{ hotkey: 'Mod+D', callback: () => runShortcut('mod+d', () => addBlock('pending', undefined, 'horizontal')) },
		{ hotkey: 'Mod+Shift+D', callback: () => runShortcut('mod+shift+d', () => addBlock('pending', undefined, 'vertical')) },

		{ hotkey: 'Mod+W', callback: () => runShortcut('mod+w', () => { if (focusedBlockId) removeBlock(focusedBlockId); }) },

		{ hotkey: 'Mod+]', callback: () => runShortcut('mod+]', () => focusNext()) },
		{ hotkey: 'Mod+[', callback: () => runShortcut('mod+[', () => focusPrev()) },

		{ hotkey: 'Mod+1', callback: () => runShortcut('mod+1', () => focusByIndex(0)) },
		{ hotkey: 'Mod+2', callback: () => runShortcut('mod+2', () => focusByIndex(1)) },
		{ hotkey: 'Mod+3', callback: () => runShortcut('mod+3', () => focusByIndex(2)) },
		{ hotkey: 'Mod+4', callback: () => runShortcut('mod+4', () => focusByIndex(3)) },
		{ hotkey: 'Mod+5', callback: () => runShortcut('mod+5', () => focusByIndex(4)) },
		{ hotkey: 'Mod+6', callback: () => runShortcut('mod+6', () => focusByIndex(5)) },
		{ hotkey: 'Mod+7', callback: () => runShortcut('mod+7', () => focusByIndex(6)) },
		{ hotkey: 'Mod+8', callback: () => runShortcut('mod+8', () => focusByIndex(7)) },
		{ hotkey: 'Mod+9', callback: () => runShortcut('mod+9', () => focusByIndex(8)) },

		{ hotkey: 'Control+H', callback: () => runShortcut('ctrl+h', () => focusDirection('left')) },
		{ hotkey: 'Control+L', callback: () => runShortcut('ctrl+l', () => focusDirection('right')) },
		{ hotkey: 'Control+K', callback: () => runShortcut('ctrl+k', () => focusDirection('up')) },
		{ hotkey: 'Control+J', callback: () => runShortcut('ctrl+j', () => focusDirection('down')) },

		{ hotkey: 'Mod+Shift+B', callback: () => runShortcut('mod+shift+b', () => toggleSidebar()) },
	]);
}
