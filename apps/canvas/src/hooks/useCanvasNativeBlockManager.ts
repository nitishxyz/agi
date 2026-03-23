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
	clearNativeBlockRuntimeState,
	getNativeBlockHost,
	setNativeBlockRuntimeState,
} from '../lib/native-block-runtime';
import {
	createGhosttyBlock,
	destroyGhosttyBlock,
	getGhosttyStatus,
	isTauriRuntime,
	setGhosttyBlockFocus,
	updateGhosttyBlock,
	type GhosttyStatus,
} from '../lib/ghostty';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceStore } from '../stores/workspace-store';

interface BoundsSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportHeight: number;
	scaleFactor: number;
	focused: boolean;
}

interface GhosttyRuntimeEntry {
	created: boolean;
	creating: boolean;
	lastBounds: BoundsSnapshot | null;
	lastFocused: boolean;
	lastSceneVersion: number;
}

interface BrowserRuntimeEntry {
	created: boolean;
	creating: boolean;
	lastUrl: string | null;
	lastReloadToken: number;
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
		Math.abs(a.scaleFactor - b.scaleFactor) < 0.01 &&
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
		scaleFactor: window.devicePixelRatio || 1,
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

function hasActiveNativeOverlayRoot() {
	return document.querySelector('[data-native-overlay-root="true"]') !== null;
}

async function focusMainCanvasSurface() {
	await getCurrentWindow().setFocus().catch(() => undefined);
	await getCurrentWebview().setFocus().catch(() => undefined);
}

function focusHostElement(element: HTMLElement | null | undefined) {
	if (!element) return;
	window.setTimeout(() => {
		element.focus();
	}, 0);
}

function scheduleGhosttyFocus(blockId: string) {
	const delays = [0, 24, 96];
	for (const delay of delays) {
		window.setTimeout(() => {
			void setGhosttyBlockFocus(blockId, true).catch(() => undefined);
		}, delay);
	}
}

export function useCanvasNativeBlockManager() {
	const blocks = useCanvasStore((s) => s.blocks);
	const focusedBlockId = useCanvasStore((s) => s.focusedBlockId);
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
	const environments = useWorkspaceStore((s) => s.environments);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const blocksRef = useRef(blocks);
	const focusedBlockIdRef = useRef(focusedBlockId);
	const activeEnvironmentPathRef = useRef<string | null>(null);
	const ghosttyStatusRef = useRef<GhosttyStatus | null>(null);
	const ghosttyEntriesRef = useRef(new Map<string, GhosttyRuntimeEntry>());
	const browserEntriesRef = useRef(new Map<string, BrowserRuntimeEntry>());
	const sceneVersionRef = useRef(0);
	const overlayActiveRef = useRef(false);

	useEffect(() => {
		blocksRef.current = blocks;
	}, [blocks]);

	useEffect(() => {
		focusedBlockIdRef.current = focusedBlockId;
	}, [focusedBlockId]);

	useEffect(() => {
		const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
		activeEnvironmentPathRef.current = activeWorkspace
			? environments[activeWorkspace.primaryEnvironmentId]?.path ?? null
			: null;
	}, [activeWorkspaceId, environments, workspaces]);

	useEffect(() => {
		if (!isTauriRuntime()) return;
		const focusedBlock = focusedBlockId ? blocks[focusedBlockId] : null;
		if (focusedBlock?.type === 'browser') return;
		void focusMainCanvasSurface();
	}, [blocks, focusedBlockId]);

	useEffect(() => {
		if (!isTauriRuntime()) return;

		let cancelled = false;
		void getGhosttyStatus()
			.then((status) => {
				if (cancelled) return;
				ghosttyStatusRef.current = status;
			})
			.catch(() => {
				if (cancelled) return;
				ghosttyStatusRef.current = {
					available: false,
					message: 'Failed to detect Ghostty availability.',
				};
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!isTauriRuntime()) return;

		let frame = 0;
		let disposed = false;

		const destroyGhosttyEntry = async (blockId: string) => {
			ghosttyEntriesRef.current.delete(blockId);
			clearNativeBlockRuntimeState(blockId);
			await destroyGhosttyBlock(blockId).catch(() => undefined);
		};

		const destroyBrowserEntry = async (blockId: string) => {
			const entry = browserEntriesRef.current.get(blockId);
			browserEntriesRef.current.delete(blockId);
			clearNativeBlockRuntimeState(blockId);
			sceneVersionRef.current += 1;
			if (entry?.created) {
				await destroyBrowserWebview(blockId).catch(() => undefined);
			}
		};

		const syncGhosttyBlock = async (
			block: Block,
			focused: boolean,
			overlayActive: boolean,
		) => {
			const status = ghosttyStatusRef.current;
			if (!status?.available) return;

			let entry = ghosttyEntriesRef.current.get(block.id);
			if (!entry) {
				entry = {
					created: false,
					creating: false,
					lastBounds: null,
					lastFocused: false,
					lastSceneVersion: -1,
				};
				ghosttyEntriesRef.current.set(block.id, entry);
			}

			if (!entry.created && !entry.creating) {
				entry.creating = true;
				try {
					await createGhosttyBlock(
						block.id,
						activeEnvironmentPathRef.current ?? undefined,
					);
					entry.created = true;
					setNativeBlockRuntimeState(block.id, { error: null });
				} catch (error) {
					setNativeBlockRuntimeState(block.id, {
						error: formatError(error),
					});
				} finally {
					entry.creating = false;
				}
			}

			if (!entry.created) return;

			const host = getNativeBlockHost(block.id);
			if (!host || host.kind !== 'terminal') return;

			const visibleFocused = overlayActive ? false : focused;
			const measuredBounds = getBoundsSnapshot(host.element, visibleFocused);
			const nextBounds = overlayActive
				? getHiddenBoundsSnapshot(measuredBounds)
				: measuredBounds;
			const boundsChanged = !areBoundsEqual(entry.lastBounds, nextBounds);
			const sceneChanged = entry.lastSceneVersion !== sceneVersionRef.current;
			if (boundsChanged || sceneChanged) {
				entry.lastBounds = nextBounds;
				await updateGhosttyBlock(block.id, nextBounds)
					.then(() => {
						entry.lastSceneVersion = sceneVersionRef.current;
						setNativeBlockRuntimeState(block.id, { error: null });
					})
					.catch((error) => {
						setNativeBlockRuntimeState(block.id, {
							error: formatError(error),
						});
					});
			}

			if (entry.lastFocused !== focused || (focused && (boundsChanged || sceneChanged))) {
				entry.lastFocused = focused;
				if (focused) {
					await focusMainCanvasSurface();
					focusHostElement(host.element);
				}
				await setGhosttyBlockFocus(block.id, focused)
					.then(() => {
						if (focused) {
							scheduleGhosttyFocus(block.id);
						}
					})
					.catch((error) => {
						setNativeBlockRuntimeState(block.id, {
							error: formatError(error),
						});
					});
			}
		};

		const syncBrowserBlock = async (block: Block, focused: boolean) => {
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

			const host = getNativeBlockHost(block.id);
			if (!host || host.kind !== 'browser') return;

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
					sceneVersionRef.current += 1;
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

		const syncAll = async () => {
			const currentBlocks = blocksRef.current;
			const activeBlocks = Object.values(currentBlocks).filter(
				(block) => block.type === 'terminal' || block.type === 'browser',
			);
			const activeIds = new Set(activeBlocks.map((block) => block.id));

			const removedGhosttyIds = Array.from(ghosttyEntriesRef.current.keys()).filter((blockId) => {
				const block = currentBlocks[blockId];
				return !activeIds.has(blockId) || block?.type !== 'terminal';
			});
			for (const blockId of removedGhosttyIds) {
				await destroyGhosttyEntry(blockId);
			}

			const removedBrowserIds = Array.from(browserEntriesRef.current.keys()).filter((blockId) => {
				const block = currentBlocks[blockId];
				return !activeIds.has(blockId) || block?.type !== 'browser';
			});
			for (const blockId of removedBrowserIds) {
				await destroyBrowserEntry(blockId);
			}

			const overlayActive = overlayActiveRef.current;
			for (const block of activeBlocks) {
				const focused = focusedBlockIdRef.current === block.id;
				if (block.type === 'terminal') {
					await syncGhosttyBlock(block, focused, overlayActive);
					continue;
				}
				await syncBrowserBlock(block, focused);
			}
		};

		const tick = async () => {
			if (disposed) return;
			const overlayActive = hasActiveNativeOverlayRoot();
			if (overlayActiveRef.current !== overlayActive) {
				overlayActiveRef.current = overlayActive;
				sceneVersionRef.current += 1;
			}
			await syncAll();
			if (disposed) return;
			frame = window.requestAnimationFrame(() => {
				void tick();
			});
		};

		frame = window.requestAnimationFrame(() => {
			void tick();
		});

		return () => {
			disposed = true;
			window.cancelAnimationFrame(frame);
			const ghosttyIds = Array.from(ghosttyEntriesRef.current.keys());
			const browserIds = Array.from(browserEntriesRef.current.keys());
			for (const blockId of ghosttyIds) {
				void destroyGhosttyEntry(blockId);
			}
			for (const blockId of browserIds) {
				void destroyBrowserEntry(blockId);
			}
		};
	}, []);
}
