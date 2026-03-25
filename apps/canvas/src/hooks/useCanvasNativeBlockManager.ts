import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef } from 'react';
import {
	createBrowserWebview,
	destroyBrowserWebview,
	navigateBrowserWebview,
	reloadBrowserWebview,
	updateBrowserWebviewBounds,
} from '../lib/browser-webview';
import {
	createNativeTerminalBlock,
	destroyNativeTerminalBlock,
	updateNativeTerminalBlock,
} from '../lib/native-terminal';
import {
	clearNativeBlockRuntimeState,
	getNativeBlockHost,
	setNativeBlockRuntimeState,
	subscribeNativeBlockHosts,
} from '../lib/native-block-runtime';
import { isTauriRuntime } from '../lib/ghostty';
import type { Block, WorkspaceSurfaceState } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

interface BoundsSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportHeight: number;
	focused: boolean;
}

interface BrowserRuntimeEntry {
	created: boolean;
	creating: boolean;
	lastUrl: string | null;
	lastReloadToken: number;
	lastBounds: BoundsSnapshot | null;
	lastFocused: boolean;
}

interface TerminalRuntimeEntry {
	created: boolean;
	creating: boolean;
	lastBounds: BoundsSnapshot | null;
	lastFocused: boolean;
}

function formatError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function areBoundsEqual(a: BoundsSnapshot | null, b: BoundsSnapshot) {
	if (!a) return false;
	return (
		Math.abs(a.x - b.x) < 0.5 &&
		Math.abs(a.y - b.y) < 0.5 &&
		Math.abs(a.width - b.width) < 0.5 &&
		Math.abs(a.height - b.height) < 0.5 &&
		a.viewportHeight === b.viewportHeight &&
		a.focused === b.focused
	);
}

function getBoundsSnapshot(element: HTMLElement, focused: boolean): BoundsSnapshot {
	const rect = element.getBoundingClientRect();
	return {
		x: rect.left,
		y: rect.top,
		width: rect.width,
		height: rect.height,
		viewportHeight: window.innerHeight,
		focused,
	};
}

function getHiddenBoundsSnapshot(bounds: BoundsSnapshot): BoundsSnapshot {
	return {
		...bounds,
		x: -10000,
		y: -10000,
		width: 1,
		height: 1,
		focused: false,
	};
}

function getDefaultHiddenBoundsSnapshot(): BoundsSnapshot {
	return {
		x: -10000,
		y: -10000,
		width: 1,
		height: 1,
		viewportHeight: window.innerHeight,
		focused: false,
	};
}

function collectWorkspaceBlocks(workspaceState: WorkspaceSurfaceState | null): Block[] {
	if (!workspaceState) return [];
	return workspaceState.tabOrder.flatMap((tabId) => {
		const tab = workspaceState.tabs[tabId];
		if (!tab) return [];
		if (tab.kind === 'canvas') return Object.values(tab.blocks);
		if (tab.kind === 'block') return [tab.block];
		return [];
	});
}

function collectAllWorkspaceBlocks(workspaceStates: Record<string, WorkspaceSurfaceState>) {
	return Object.entries(workspaceStates).flatMap(([workspaceId, workspaceState]) =>
		collectWorkspaceBlocks(workspaceState).map((block) => ({ workspaceId, block })),
	);
}

function collectActiveTabBlockIds(workspaceState: WorkspaceSurfaceState | null) {
	if (!workspaceState?.activeTabId) return new Set<string>();
	const activeTab = workspaceState.tabs[workspaceState.activeTabId];
	if (!activeTab) return new Set<string>();
	if (activeTab.kind === 'canvas') {
		return new Set(Object.keys(activeTab.blocks));
	}
	if (activeTab.kind === 'pending') {
		return new Set<string>();
	}
	return new Set([activeTab.block.id]);
}

function hasActiveNativeOverlayRoot() {
	return document.querySelector('[data-native-overlay-root="true"]') !== null;
}

async function focusMainCanvasSurface() {
	await getCurrentWindow().setFocus().catch(() => undefined);
	await getCurrentWebview().setFocus().catch(() => undefined);
}

export function useCanvasNativeBlockManager() {
	const blocks = useCanvasStore((s) => s.blocks);
	const workspaceStates = useCanvasStore((s) => s.workspaceStates);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
	const focusedBlockIdRef = useRef(focusedBlockId);
	const workspaceStatesRef = useRef(workspaceStates);
	const activeWorkspaceIdRef = useRef(activeWorkspaceId);
	const browserEntriesRef = useRef(new Map<string, BrowserRuntimeEntry>());
	const terminalEntriesRef = useRef(new Map<string, TerminalRuntimeEntry>());
	const overlayActiveRef = useRef(false);
	const queueSyncRef = useRef<() => void>(() => undefined);

	useEffect(() => {
		workspaceStatesRef.current = workspaceStates;
	}, [workspaceStates]);

	useEffect(() => {
		activeWorkspaceIdRef.current = activeWorkspaceId;
	}, [activeWorkspaceId]);

	useEffect(() => {
		focusedBlockIdRef.current = focusedBlockId;
	}, [focusedBlockId]);

	useEffect(() => {
		if (!isTauriRuntime()) return;
		const focusedBlock = focusedBlockId ? blocks[focusedBlockId] : null;
		if (focusedBlock?.type === 'browser' || focusedBlock?.type === 'terminal') return;
		if (focusedBlock?.type === 'command' && (focusedBlock.command?.trim() ?? '').length > 0) {
			return;
		}
		void focusMainCanvasSurface();
	}, [blocks, focusedBlockId]);

	useEffect(() => {
		if (!isTauriRuntime()) return;

		let frame = 0;
		let disposed = false;
		let syncQueued = false;
		let syncInFlight = false;
		let resyncRequested = false;

		const destroyBrowserEntry = async (blockId: string) => {
			const entry = browserEntriesRef.current.get(blockId);
			browserEntriesRef.current.delete(blockId);
			clearNativeBlockRuntimeState(blockId);
			if (entry?.created) {
				await destroyBrowserWebview(blockId).catch(() => undefined);
			}
		};

		const destroyTerminalEntry = async (blockId: string) => {
			const entry = terminalEntriesRef.current.get(blockId);
			terminalEntriesRef.current.delete(blockId);
			clearNativeBlockRuntimeState(blockId);
			if (entry?.created) {
				await destroyNativeTerminalBlock(blockId).catch(() => undefined);
			}
		};

		const syncBrowserBlock = async (block: Block, focused: boolean, visible: boolean) => {
			let entry = browserEntriesRef.current.get(block.id);
			if (!entry) {
				entry = {
					created: false,
					creating: false,
					lastUrl: null,
					lastReloadToken: 0,
					lastBounds: null,
					lastFocused: false,
				};
				browserEntriesRef.current.set(block.id, entry);
			}

			const nextUrl = block.url?.trim() ?? '';
			const nextReloadToken = block.reloadToken ?? 0;
			if (!nextUrl) {
				entry.lastUrl = null;
				entry.lastReloadToken = nextReloadToken;
				entry.lastBounds = null;
				entry.lastFocused = false;
				if (entry.created) {
					entry.created = false;
					await destroyBrowserWebview(block.id).catch((error) => {
						setNativeBlockRuntimeState(block.id, {
							error: formatError(error),
						});
					});
				}
				setNativeBlockRuntimeState(block.id, {
					loading: false,
					error: null,
				});
				return;
			}

			if (!visible) {
				if (entry.created) {
					const hiddenBounds = entry.lastBounds
						? getHiddenBoundsSnapshot(entry.lastBounds)
						: getDefaultHiddenBoundsSnapshot();
					if (!areBoundsEqual(entry.lastBounds, hiddenBounds) || entry.lastFocused) {
						entry.lastBounds = hiddenBounds;
						entry.lastFocused = false;
						await updateBrowserWebviewBounds(block.id, {
							x: hiddenBounds.x,
							y: hiddenBounds.y,
							width: hiddenBounds.width,
							height: hiddenBounds.height,
							viewportHeight: hiddenBounds.viewportHeight,
							focused: false,
						}).catch(() => undefined);
					}
				}
				return;
			}

			const host = getNativeBlockHost(block.id);
			if (!host || host.kind !== 'browser') {
				if (entry.created) {
					const hiddenBounds = entry.lastBounds
						? getHiddenBoundsSnapshot(entry.lastBounds)
						: getDefaultHiddenBoundsSnapshot();
					if (!areBoundsEqual(entry.lastBounds, hiddenBounds) || entry.lastFocused) {
						entry.lastBounds = hiddenBounds;
						entry.lastFocused = false;
						await updateBrowserWebviewBounds(block.id, {
							x: hiddenBounds.x,
							y: hiddenBounds.y,
							width: hiddenBounds.width,
							height: hiddenBounds.height,
							viewportHeight: hiddenBounds.viewportHeight,
							focused: false,
						}).catch(() => undefined);
					}
				}
				return;
			}

			const nextBounds = getBoundsSnapshot(host.element, focused);
			if (!entry.created && !entry.creating) {
				entry.creating = true;
				setNativeBlockRuntimeState(block.id, {
					loading: true,
					error: null,
				});
				try {
					await createBrowserWebview(block.id, nextUrl, window.navigator.userAgent);
					entry.created = true;
					entry.lastUrl = nextUrl;
					entry.lastReloadToken = nextReloadToken;
					entry.lastBounds = null;
					entry.lastFocused = false;
					setNativeBlockRuntimeState(block.id, {
						loading: false,
						error: null,
					});
				} catch (error) {
					setNativeBlockRuntimeState(block.id, {
						loading: false,
						error: formatError(error),
					});
				} finally {
					entry.creating = false;
				}
			}

			if (!entry.created) return;

			if (entry.lastUrl !== nextUrl) {
				entry.lastUrl = nextUrl;
				setNativeBlockRuntimeState(block.id, {
					loading: true,
					error: null,
				});
				await navigateBrowserWebview(block.id, nextUrl)
					.then(() => {
						setNativeBlockRuntimeState(block.id, {
							loading: false,
							error: null,
						});
					})
					.catch((error) => {
						setNativeBlockRuntimeState(block.id, {
							loading: false,
							error: formatError(error),
						});
					});
			}

			if (entry.lastReloadToken !== nextReloadToken) {
				entry.lastReloadToken = nextReloadToken;
				setNativeBlockRuntimeState(block.id, {
					loading: true,
					error: null,
				});
				await reloadBrowserWebview(block.id)
					.then(() => {
						setNativeBlockRuntimeState(block.id, {
							loading: false,
							error: null,
						});
					})
					.catch((error) => {
						setNativeBlockRuntimeState(block.id, {
							loading: false,
							error: formatError(error),
						});
					});
			}

			if (entry.lastFocused !== focused || !areBoundsEqual(entry.lastBounds, nextBounds)) {
				entry.lastFocused = focused;
				entry.lastBounds = nextBounds;
				await updateBrowserWebviewBounds(block.id, {
					x: nextBounds.x,
					y: nextBounds.y,
					width: nextBounds.width,
					height: nextBounds.height,
					viewportHeight: nextBounds.viewportHeight,
					focused,
				}).catch((error) => {
					setNativeBlockRuntimeState(block.id, {
						error: formatError(error),
					});
				});
			}
		};

		const syncTerminalBlock = async (block: Block, focused: boolean, visible: boolean) => {
			let entry = terminalEntriesRef.current.get(block.id);
			if (!entry) {
				entry = {
					created: false,
					creating: false,
					lastBounds: null,
					lastFocused: false,
				};
				terminalEntriesRef.current.set(block.id, entry);
			}

			if (!visible) {
				if (entry.created) {
					const hiddenBounds = entry.lastBounds
						? getHiddenBoundsSnapshot(entry.lastBounds)
						: getDefaultHiddenBoundsSnapshot();
					if (!areBoundsEqual(entry.lastBounds, hiddenBounds) || entry.lastFocused) {
						entry.lastBounds = hiddenBounds;
						entry.lastFocused = false;
						await updateNativeTerminalBlock(block.id, {
							x: hiddenBounds.x,
							y: hiddenBounds.y,
							width: hiddenBounds.width,
							height: hiddenBounds.height,
							viewportHeight: hiddenBounds.viewportHeight,
							focused: false,
							hidden: true,
						}).catch(() => undefined);
					}
				}
				return;
			}

			const host = getNativeBlockHost(block.id);
			if (!host || host.kind !== 'terminal') {
				return;
			}

			const nextBounds = getBoundsSnapshot(host.element, focused);
			if (!entry.created && !entry.creating) {
				entry.creating = true;
				setNativeBlockRuntimeState(block.id, {
					loading: true,
					error: null,
				});
				try {
					const cwd = block.cwd?.trim() || undefined;
					const command = block.type === 'command' ? block.command?.trim() || undefined : undefined;
					await createNativeTerminalBlock(block.id, cwd, command);
					entry.created = true;
					entry.lastBounds = null;
					entry.lastFocused = false;
					setNativeBlockRuntimeState(block.id, {
						loading: false,
						error: null,
					});
				} catch (error) {
					setNativeBlockRuntimeState(block.id, {
						loading: false,
						error: formatError(error),
					});
				} finally {
					entry.creating = false;
				}
			}

			if (!entry.created) return;

			if (entry.lastFocused !== focused || !areBoundsEqual(entry.lastBounds, nextBounds)) {
				entry.lastFocused = focused;
				entry.lastBounds = nextBounds;
				await updateNativeTerminalBlock(block.id, {
					x: nextBounds.x,
					y: nextBounds.y,
					width: nextBounds.width,
					height: nextBounds.height,
					viewportHeight: nextBounds.viewportHeight,
					focused,
					hidden: false,
				}).catch((error) => {
					setNativeBlockRuntimeState(block.id, {
						error: formatError(error),
					});
				});
			}
		};

		const syncAll = async () => {
			const activeWorkspaceState = activeWorkspaceIdRef.current
				? workspaceStatesRef.current[activeWorkspaceIdRef.current] ?? null
				: null;
			const allBlocks = collectAllWorkspaceBlocks(workspaceStatesRef.current);
			const activeTabBlockIds = collectActiveTabBlockIds(activeWorkspaceState);
			const browserBlocks = allBlocks.filter(({ block }) => block.type === 'browser');
			const terminalBlocks = allBlocks.filter(
				({ block }) =>
					block.type === 'terminal' ||
					(block.type === 'command' && (block.command?.trim() ?? '').length > 0),
			);
			const browserIds = new Set(browserBlocks.map(({ block }) => block.id));
			const terminalIds = new Set(terminalBlocks.map(({ block }) => block.id));
			const currentBrowserBlockMap = new Map(browserBlocks.map((entry) => [entry.block.id, entry]));

			const removedBrowserIds = Array.from(browserEntriesRef.current.keys()).filter((blockId) => {
				const entry = currentBrowserBlockMap.get(blockId);
				return !browserIds.has(blockId) || entry?.block.type !== 'browser';
			});
			for (const blockId of removedBrowserIds) {
				await destroyBrowserEntry(blockId);
			}

			const removedTerminalIds = Array.from(terminalEntriesRef.current.keys()).filter(
				(blockId) => !terminalIds.has(blockId),
			);
			for (const blockId of removedTerminalIds) {
				await destroyTerminalEntry(blockId);
			}

			const overlayActive = overlayActiveRef.current;
			for (const { block } of browserBlocks) {
				const visible = activeTabBlockIds.has(block.id) && !overlayActive;
				const focused = visible && focusedBlockIdRef.current === block.id;
				await syncBrowserBlock(block, focused, visible);
			}
			for (const { block } of terminalBlocks) {
				const visible = activeTabBlockIds.has(block.id) && !overlayActive;
				const focused = visible && focusedBlockIdRef.current === block.id;
				await syncTerminalBlock(block, focused, visible);
			}
		};

		const runSync = () => {
			if (disposed) return;
			syncQueued = false;
			if (syncInFlight) {
				resyncRequested = true;
				return;
			}
			syncInFlight = true;
			void (async () => {
				const overlayActive = hasActiveNativeOverlayRoot();
				if (overlayActiveRef.current !== overlayActive) {
					overlayActiveRef.current = overlayActive;
				}
				await syncAll();
			})().finally(() => {
				syncInFlight = false;
				if (resyncRequested && !disposed) {
					resyncRequested = false;
					scheduleSync();
				}
			});
		};

		const scheduleSync = () => {
			if (disposed || syncQueued) return;
			syncQueued = true;
			frame = window.requestAnimationFrame(runSync);
		};

		queueSyncRef.current = scheduleSync;

		const handleWindowChange = () => {
			scheduleSync();
		};
		const overlayObserver = new MutationObserver(() => {
			scheduleSync();
		});
		if (document.body) {
			overlayObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
			});
		}
		window.addEventListener('resize', handleWindowChange);
		window.addEventListener('scroll', handleWindowChange, true);
		const unsubscribeHosts = subscribeNativeBlockHosts(handleWindowChange);

		scheduleSync();

		return () => {
			disposed = true;
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', handleWindowChange);
			window.removeEventListener('scroll', handleWindowChange, true);
			overlayObserver.disconnect();
			unsubscribeHosts();
			queueSyncRef.current = () => undefined;
			const browserIds = Array.from(browserEntriesRef.current.keys());
			for (const blockId of browserIds) {
				void destroyBrowserEntry(blockId);
			}
			const terminalIds = Array.from(terminalEntriesRef.current.keys());
			for (const blockId of terminalIds) {
				void destroyTerminalEntry(blockId);
			}
		};
	}, []);

	useEffect(() => {
		if (!isTauriRuntime()) return;
		queueSyncRef.current();
	}, [workspaceStates, focusedBlockId, activeWorkspaceId]);
}
