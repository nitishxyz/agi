import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { useCallback, useEffect, useRef } from 'react';
import { isTauriRuntime } from '../lib/ghostty';
import { getSidebarOrderedTabs } from '../lib/sidebar-tab-order';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function isEditableShortcutTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	) {
		return true;
	}
	return Boolean(
		target.closest(
			'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
		),
	);
}

export function useCanvasKeybinds() {
	const addBlock = useCanvasStore((s) => s.addBlock);
	const blocks = useCanvasStore((s) => s.blocks);
	const tabs = useCanvasStore((s) => s.tabs);
	const tabOrder = useCanvasStore((s) => s.tabOrder);
	const convertBlock = useCanvasStore((s) => s.convertBlock);
	const convertBlockToPreset = useCanvasStore((s) => s.convertBlockToPreset);
	const removeBlock = useCanvasStore((s) => s.removeBlock);
	const createTab = useCanvasStore((s) => s.createTab);
	const createPresetTab = useCanvasStore((s) => s.createPresetTab);
	const closeCreateTab = useCanvasStore((s) => s.closeCreateTab);
	const activeTabId = useCanvasStore((s) => s.activeTabId);
	const setActiveTab = useCanvasStore((s) => s.setActiveTab);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const activeTabKind = useCanvasStore((s) => s.activeTabKind);
	const focusNext = useCanvasStore((s) => s.focusNext);
	const focusPrev = useCanvasStore((s) => s.focusPrev);
	const focusByIndex = useCanvasStore((s) => s.focusByIndex);
	const focusDirection = useCanvasStore((s) => s.focusDirection);
	const openCreateTab = useCanvasStore((s) => s.openCreateTab);
	const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
	const lastShortcutAtRef = useRef<Record<string, number>>({});
	const latestExecuteShortcutRef = useRef<(shortcut: string) => void>(() => undefined);
	const latestHandlePendingSelectionRef = useRef<
		(key: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'escape') => boolean
	>(() => false);

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

	const debugLog = useCallback((message: string) => {
		void invoke('canvas_debug_log', {
			component: 'web-hotkeys',
			message,
		}).catch(() => undefined);
	}, []);

	const focusCanvasWebview = () => {
		void getCurrentWebview().setFocus().catch(() => undefined);
	};

	const shouldBypassCanvasShortcut = useCallback((event: KeyboardEvent) => {
		return isEditableShortcutTarget(event.target);
	}, []);

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

	const switchToTabByIndex = useCallback(
		(index: number) => {
			const canvasState = useCanvasStore.getState();
			const workspaceId = canvasState.activeWorkspaceId;
			const currentTabs = canvasState.tabs;
			const currentActiveTabId = canvasState.activeTabId;
			const currentOrderedTabs = canvasState.tabOrder
				.map((tabId) => currentTabs[tabId])
				.filter((tab): tab is NonNullable<(typeof currentTabs)[string]> => Boolean(tab));
			const sidebarOrderedTabs = getSidebarOrderedTabs(currentOrderedTabs);
			const nextTab = sidebarOrderedTabs[index];
			const tabId = nextTab?.id;
			if (!tabId || !nextTab) {
				debugLog(
					`switchToTabByIndex missing-tab-id workspaceId=${workspaceId ?? 'null'} index=${index} sidebarOrderLength=${sidebarOrderedTabs.length}`,
				);
				return;
			}
			debugLog(
				`switchToTabByIndex workspaceId=${workspaceId ?? 'null'} index=${index} tabId=${tabId} kind=${nextTab.kind} activeTabId=${currentActiveTabId ?? 'null'}`,
			);
			setActiveTab(tabId);
			if (nextTab.kind !== 'block') {
				focusCanvasWebview();
			}
		},
		[debugLog, setActiveTab],
	);

	const handlePendingBlockSelection = (key: '1' | '2' | '3' | '4' | '5' | '6' | 'escape') => {
		if (!focusedBlockId) return false;
		const block = blocks[focusedBlockId];
		if (!block || block.type !== 'pending') return false;

		if (key === 'escape') {
			removeBlock(focusedBlockId);
			focusCanvasWebview();
			return true;
		}

		if (key === '5') {
			convertBlockToPreset(focusedBlockId, 'claude-code');
			focusCanvasWebview();
			return true;
		}
		if (key === '6') {
			convertBlockToPreset(focusedBlockId, 'codex');
			focusCanvasWebview();
			return true;
		}

		const type =
			key === '1'
				? 'terminal'
				: key === '2'
					? 'browser'
					: key === '3'
						? 'otto'
						: 'command';
		convertBlock(focusedBlockId, type);
		focusCanvasWebview();
		return true;
	};

	const handlePendingTabSelection = useCallback(
		(key: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'escape') => {
			if (!activeTabId || activeTabKind !== 'pending') return false;
			const activeTab = tabs[activeTabId];
			if (!activeTab || activeTab.kind !== 'pending') return false;

			if (key === 'escape') {
				closeCreateTab();
				focusCanvasWebview();
				return true;
			}

			if (key === '6') {
				createPresetTab('claude-code');
				focusCanvasWebview();
				return true;
			}
			if (key === '7') {
				createPresetTab('codex');
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
							: key === '4'
								? 'otto'
								: 'command';
			createTab(kind);
			focusCanvasWebview();
			return true;
		},
		[activeTabId, activeTabKind, closeCreateTab, createPresetTab, createTab, tabs],
	);

	const handlePendingSelection = useCallback(
		(key: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'escape') =>
			handlePendingTabSelection(key) ||
			(key === '7' ? false : handlePendingBlockSelection(key)),
		[handlePendingTabSelection],
	);

	const executeShortcut = useCallback(
		(shortcut: string) => {
			if (/^(mod|ctrl\+shift)\+[1-9]$/.test(shortcut)) {
				const canvasState = useCanvasStore.getState();
				debugLog(
					`executeShortcut shortcut=${shortcut} workspaceId=${canvasState.activeWorkspaceId ?? 'null'} activeTabId=${canvasState.activeTabId ?? 'null'} tabOrderLength=${canvasState.tabOrder.length}`,
				);
			}
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
					runShortcut('mod+1', () => switchToTabByIndex(0));
					break;
				case 'mod+2':
					runShortcut('mod+2', () => switchToTabByIndex(1));
					break;
				case 'mod+3':
					runShortcut('mod+3', () => switchToTabByIndex(2));
					break;
				case 'mod+4':
					runShortcut('mod+4', () => switchToTabByIndex(3));
					break;
				case 'mod+5':
					runShortcut('mod+5', () => switchToTabByIndex(4));
					break;
				case 'mod+6':
					runShortcut('mod+6', () => switchToTabByIndex(5));
					break;
				case 'mod+7':
					runShortcut('mod+7', () => switchToTabByIndex(6));
					break;
				case 'mod+8':
					runShortcut('mod+8', () => switchToTabByIndex(7));
					break;
				case 'mod+9':
					runShortcut('mod+9', () => switchToTabByIndex(8));
					break;
				case 'ctrl+shift+1':
					runShortcut('ctrl+shift+1', () => focusByIndex(0));
					break;
				case 'ctrl+shift+2':
					runShortcut('ctrl+shift+2', () => focusByIndex(1));
					break;
				case 'ctrl+shift+3':
					runShortcut('ctrl+shift+3', () => focusByIndex(2));
					break;
				case 'ctrl+shift+4':
					runShortcut('ctrl+shift+4', () => focusByIndex(3));
					break;
				case 'ctrl+shift+5':
					runShortcut('ctrl+shift+5', () => focusByIndex(4));
					break;
				case 'ctrl+shift+6':
					runShortcut('ctrl+shift+6', () => focusByIndex(5));
					break;
				case 'ctrl+shift+7':
					runShortcut('ctrl+shift+7', () => focusByIndex(6));
					break;
				case 'ctrl+shift+8':
					runShortcut('ctrl+shift+8', () => focusByIndex(7));
					break;
				case 'ctrl+shift+9':
					runShortcut('ctrl+shift+9', () => focusByIndex(8));
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
			debugLog,
			focusByIndex,
			focusDirection,
			focusNext,
			focusPrev,
			openTabCreator,
			removeFocusedBlock,
			switchToTabByIndex,
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

	useHotkeys(
		[
			{ hotkey: 'Mod+N', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+n') },
			{ hotkey: 'Mod+T', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+t') },
			{ hotkey: 'Mod+D', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+d') },
			{ hotkey: 'Mod+Shift+D', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+shift+d') },
			{ hotkey: 'Mod+W', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+w') },
			{ hotkey: 'Mod+[', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+[') },
			{ hotkey: 'Mod+]', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+]') },
			{ hotkey: 'Mod+1', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+1') },
			{ hotkey: 'Mod+2', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+2') },
			{ hotkey: 'Mod+3', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+3') },
			{ hotkey: 'Mod+4', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+4') },
			{ hotkey: 'Mod+5', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+5') },
			{ hotkey: 'Mod+6', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+6') },
			{ hotkey: 'Mod+7', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+7') },
			{ hotkey: 'Mod+8', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+8') },
			{ hotkey: 'Mod+9', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+9') },
			{ hotkey: 'Control+Shift+1', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+1') },
			{ hotkey: 'Control+Shift+2', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+2') },
			{ hotkey: 'Control+Shift+3', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+3') },
			{ hotkey: 'Control+Shift+4', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+4') },
			{ hotkey: 'Control+Shift+5', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+5') },
			{ hotkey: 'Control+Shift+6', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+6') },
			{ hotkey: 'Control+Shift+7', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+7') },
			{ hotkey: 'Control+Shift+8', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+8') },
			{ hotkey: 'Control+Shift+9', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+shift+9') },
			{ hotkey: 'Control+H', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+h') },
			{ hotkey: 'Control+J', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+j') },
			{ hotkey: 'Control+K', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+k') },
			{ hotkey: 'Control+L', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('ctrl+l') },
			{ hotkey: 'Mod+Shift+B', callback: (event) => !shouldBypassCanvasShortcut(event) && executeShortcut('mod+shift+b') },
		],
		{ conflictBehavior: 'replace' },
	);

	useEffect(() => {
		latestExecuteShortcutRef.current = executeShortcut;
		latestHandlePendingSelectionRef.current = handlePendingSelection;
	}, [executeShortcut, handlePendingSelection]);

	useEffect(() => {
		if (!isTauriRuntime()) {
			return;
		}

		let unlistenGhostty: (() => void) | undefined;
		const handleShortcut = (shortcut: string) => {
			debugLog(`nativeShortcut shortcut=${shortcut}`);
			if (shortcut === 'plain+1') {
				latestHandlePendingSelectionRef.current('1');
				return;
			}
			if (shortcut === 'plain+2') {
				latestHandlePendingSelectionRef.current('2');
				return;
			}
			if (shortcut === 'plain+3') {
				latestHandlePendingSelectionRef.current('3');
				return;
			}
			if (shortcut === 'plain+4') {
				latestHandlePendingSelectionRef.current('4');
				return;
			}
			if (shortcut === 'plain+5') {
				latestHandlePendingSelectionRef.current('5');
				return;
			}
			if (shortcut === 'plain+6') {
				latestHandlePendingSelectionRef.current('6');
				return;
			}
			if (shortcut === 'plain+7') {
				latestHandlePendingSelectionRef.current('7');
				return;
			}
			if (shortcut === 'escape') {
				latestHandlePendingSelectionRef.current('escape');
				return;
			}
			latestExecuteShortcutRef.current(shortcut);
		};

		void listen<{ shortcut: string }>('ghostty-native-shortcut', (event) => {
			handleShortcut(event.payload.shortcut);
		}).then((dispose) => {
			unlistenGhostty = dispose;
		});

		return () => {
			unlistenGhostty?.();
		};
	}, [debugLog]);

	useEffect(() => {
		const workspaceId = useCanvasStore.getState().activeWorkspaceId;
		debugLog(
			`activeTabChanged workspaceId=${workspaceId ?? 'null'} activeTabId=${activeTabId ?? 'null'} activeTabKind=${activeTabKind ?? 'null'} tabOrderLength=${tabOrder.length}`,
		);
	}, [activeTabId, activeTabKind, debugLog, tabOrder.length]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.metaKey && !event.ctrlKey && !event.altKey) {
				if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4' || event.key === '5' || event.key === '6' || event.key === '7') {
					if (handlePendingSelection(event.key as '1' | '2' | '3' | '4' | '5' | '6' | '7')) {
						event.preventDefault();
					}
					return;
				}
				if (event.key === 'Escape' && handlePendingSelection('escape')) {
					event.preventDefault();
					return;
				}
			}
		};

		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [handlePendingSelection]);
}
