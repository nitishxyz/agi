import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useCallback, useEffect, useRef } from 'react';
import { isTauriRuntime } from '../lib/ghostty';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function shortcutFromEvent(event: KeyboardEvent): string | null {
	if (event.metaKey && !event.altKey) {
		if (event.key.toLowerCase() === 'n') return 'mod+n';
		if (event.key.toLowerCase() === 't') return 'mod+t';
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
	const blocks = useCanvasStore((s) => s.blocks);
	const tabs = useCanvasStore((s) => s.tabs);
	const convertBlock = useCanvasStore((s) => s.convertBlock);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const createTab = useCanvasStore((s) => s.createTab);
	const closeCreateTab = useCanvasStore((s) => s.closeCreateTab);
	const activeTabId = useCanvasStore((s) => s.activeTabId);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const activeTabKind = useCanvasStore((s) => s.activeTabKind);
	const focusNext = useCanvasStore((s) => s.focusNext);
	const focusPrev = useCanvasStore((s) => s.focusPrev);
	const focusByIndex = useCanvasStore((s) => s.focusByIndex);
	const focusDirection = useCanvasStore((s) => s.focusDirection);
	const openCreateTab = useCanvasStore((s) => s.openCreateTab);
	const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
	const lastShortcutAtRef = useRef<Record<string, number>>({});

	const removeFocusedBlock = useCallback(() => {
		const { focusedBlockId: currentFocusedBlockId, removeBlock: removeCurrentBlock } =
			useCanvasStore.getState();
		if (!currentFocusedBlockId) return;
		removeCurrentBlock(currentFocusedBlockId);
	}, []);

	const runShortcut = (shortcut: string, callback: () => void) => {
		const now = Date.now();
		const last = lastShortcutAtRef.current[shortcut] ?? 0;
		if (now - last < 250) {
			return;
		}
		lastShortcutAtRef.current[shortcut] = now;
		callback();
	};

	const focusCanvasWebview = () => {
		void getCurrentWebview().setFocus().catch(() => undefined);
	};

	const createBlockOrOpenTab = useCallback(() => {
		if (useCanvasStore.getState().activeTabKind === 'canvas') {
			addBlock('pending');
			focusCanvasWebview();
			return;
		}
		focusCanvasWebview();
		openCreateTab();
	}, [addBlock, openCreateTab]);

	const openTabCreator = useCallback(() => {
		focusCanvasWebview();
		openCreateTab();
	}, [openCreateTab]);

	const handlePendingBlockSelection = (key: '1' | '2' | '3' | 'escape') => {
		if (!focusedBlockId) return false;
		const block = blocks[focusedBlockId];
		if (!block || block.type !== 'pending') return false;

		if (key === 'escape') {
			removeBlock(focusedBlockId);
			focusCanvasWebview();
			return true;
		}

		const type = key === '1' ? 'terminal' : key === '2' ? 'browser' : 'otto';
		convertBlock(focusedBlockId, type);
		focusCanvasWebview();
		return true;
	};

	const handlePendingTabSelection = useCallback(
		(key: '1' | '2' | '3' | '4' | 'escape') => {
			if (!activeTabId || activeTabKind !== 'pending') return false;
			const activeTab = tabs[activeTabId];
			if (!activeTab || activeTab.kind !== 'pending') return false;

			if (key === 'escape') {
				closeCreateTab();
				focusCanvasWebview();
				return true;
			}

			const kind =
				key === '1'
					? 'canvas'
					: key === '2'
						? 'terminal'
						: key === '3'
							? 'browser'
							: 'otto';
			createTab(kind);
			focusCanvasWebview();
			return true;
		},
		[activeTabId, activeTabKind, closeCreateTab, createTab, tabs],
	);

	const handlePendingSelection = useCallback(
		(key: '1' | '2' | '3' | '4' | 'escape') =>
			handlePendingTabSelection(key) ||
			(key === '4' ? false : handlePendingBlockSelection(key)),
		[handlePendingTabSelection],
	);

	const executeShortcut = useCallback(
		(shortcut: string) => {
			switch (shortcut) {
				case 'mod+n':
					runShortcut('mod+n', createBlockOrOpenTab);
					break;
				case 'mod+t':
					runShortcut('mod+t', openTabCreator);
					break;
				case 'mod+d':
					runShortcut('mod+d', () => {
						addBlock('pending', undefined, 'horizontal');
						focusCanvasWebview();
					});
					break;
				case 'mod+shift+d':
					runShortcut('mod+shift+d', () => {
						addBlock('pending', undefined, 'vertical');
						focusCanvasWebview();
					});
					break;
				case 'mod+w':
					runShortcut('mod+w', removeFocusedBlock);
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
		},
		[
			addBlock,
			createBlockOrOpenTab,
			focusByIndex,
			focusDirection,
			focusNext,
			focusPrev,
			openTabCreator,
			removeFocusedBlock,
			toggleSidebar,
		],
	);

	useEffect(() => {
		if (!isTauriRuntime()) return;
		const enabled =
			(activeTabKind === 'pending') ||
			(!!focusedBlockId && blocks[focusedBlockId]?.type === 'pending');
		void invoke('canvas_set_pending_shortcut_mode', { enabled }).catch(() => undefined);
	}, [activeTabKind, blocks, focusedBlockId]);

	useEffect(() => {
		if (!isTauriRuntime()) {
			return;
		}

		let unlisten: (() => void) | undefined;
		void listen<{ shortcut: string }>('ghostty-native-shortcut', (event) => {
			if (event.payload.shortcut === 'plain+1') {
				handlePendingSelection('1');
				return;
			}
			if (event.payload.shortcut === 'plain+2') {
				handlePendingSelection('2');
				return;
			}
			if (event.payload.shortcut === 'plain+3') {
				handlePendingSelection('3');
				return;
			}
			if (event.payload.shortcut === 'plain+4') {
				handlePendingSelection('4');
				return;
			}
			if (event.payload.shortcut === 'escape') {
				handlePendingSelection('escape');
				return;
			}
			executeShortcut(event.payload.shortcut);
		}).then((dispose) => {
			unlisten = dispose;
		});

		return () => {
			unlisten?.();
		};
	}, [
		executeShortcut,
		handlePendingSelection,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.metaKey && !event.ctrlKey && !event.altKey) {
				if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4') {
					if (handlePendingSelection(event.key as '1' | '2' | '3' | '4')) {
						event.preventDefault();
					}
					return;
				}
				if (event.key === 'Escape' && handlePendingSelection('escape')) {
					event.preventDefault();
					return;
				}
			}

			const shortcut = shortcutFromEvent(event);
			if (!shortcut) return;

			event.preventDefault();
			executeShortcut(shortcut);
		};

		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [
		executeShortcut,
		handlePendingSelection,
	]);
}
