import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	getCommandPresetDefinition,
	type CommandPresetId,
	type PrimitiveBlockType,
	type PrimitiveTabKind,
} from '../lib/primitive-registry';
import { useWorkspaceStore } from './workspace-store';

export type BlockType = PrimitiveBlockType | 'pending';
export type SplitDirection = 'horizontal' | 'vertical';
export type WorkspaceTabKind = 'canvas' | PrimitiveTabKind;
export type ActiveTabKind = 'canvas' | 'block' | 'pending' | null;

export interface Block {
	id: string;
	type: BlockType;
	label: string;
	url?: string;
	reloadToken?: number;
	sessionId?: string;
	command?: string;
	cwd?: string;
	presetId?: CommandPresetId;
}

export interface SplitNode {
	kind: 'split';
	id: string;
	direction: SplitDirection;
	ratio: number;
	first: LayoutNode;
	second: LayoutNode;
}

export interface LeafNode {
	kind: 'leaf';
	blockId: string;
}

export type LayoutNode = SplitNode | LeafNode;

export interface CanvasWorkspaceTab {
	id: string;
	kind: 'canvas';
	title: string;
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	updatedAt: number;
}

export interface BlockWorkspaceTab {
	id: string;
	kind: 'block';
	title: string;
	block: Block;
	updatedAt: number;
}

export interface PendingWorkspaceTab {
	id: string;
	kind: 'pending';
	title: string;
	updatedAt: number;
}

export type WorkspaceTabState = CanvasWorkspaceTab | BlockWorkspaceTab | PendingWorkspaceTab;

export interface WorkspaceSurfaceState {
	tabs: Record<string, WorkspaceTabState>;
	tabOrder: string[];
	activeTabId: string | null;
	updatedAt: number;
}

interface LegacyWorkspaceCanvasState {
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	updatedAt: number;
}

interface CanvasState {
	activeWorkspaceId: string | null;
	activeTabId: string | null;
	activeTabKind: ActiveTabKind;
	workspaceStates: Record<string, WorkspaceSurfaceState>;
	tabs: Record<string, WorkspaceTabState>;
	tabOrder: string[];
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	activateWorkspace: (workspaceId: string | null) => void;
	deleteWorkspaceState: (workspaceId: string) => void;
	setActiveTab: (tabId: string) => void;
	openCreateTab: () => void;
	closeCreateTab: () => void;
	createTab: (kind: WorkspaceTabKind, title?: string) => string | null;
	createPresetTab: (presetId: CommandPresetId) => string | null;
	removeTab: (tabId: string) => void;
	setFocused: (id: string) => void;
	addBlock: (type: BlockType, label?: string, direction?: SplitDirection) => void;
	addPresetBlock: (presetId: CommandPresetId, direction?: SplitDirection) => void;
	convertBlock: (id: string, type: BlockType) => void;
	convertBlockToPreset: (id: string, presetId: CommandPresetId) => void;
	setBlockUrl: (id: string, url: string) => void;
	setBlockSessionId: (id: string, sessionId: string | null) => void;
	setCommandBlockConfig: (
		id: string,
		config: { label?: string | null; command: string; cwd?: string | null },
	) => void;
	reloadBlock: (id: string) => void;
	removeBlock: (id: string) => void;
	setSplitRatio: (splitId: string, ratio: number) => void;
	focusNext: () => void;
	focusPrev: () => void;
	focusByIndex: (index: number) => void;
	focusDirection: (dir: 'left' | 'right' | 'up' | 'down') => void;
}

const LABELS: Record<BlockType, string> = {
	terminal: 'Ghostty',
	browser: 'Browser',
	otto: 'Otto',
	command: 'Custom command',
	pending: 'New Block',
};

const TAB_LABELS: Record<WorkspaceTabKind, string> = {
	canvas: 'Canvas',
	terminal: LABELS.terminal,
	browser: LABELS.browser,
	otto: LABELS.otto,
	command: LABELS.command,
};

function generateId() {
	return crypto.randomUUID().slice(0, 8);
}

function createBlock(type: BlockType, label?: string): Block {
	return {
		id: generateId(),
		type,
		label: label ?? LABELS[type],
		url: type === 'browser' ? '' : undefined,
		reloadToken: type === 'browser' ? 0 : undefined,
		command: type === 'command' ? '' : undefined,
		cwd: type === 'command' ? undefined : undefined,
	};
}

function createCommandPresetBlock(presetId: CommandPresetId): Block {
	const preset = getCommandPresetDefinition(presetId);
	return {
		id: generateId(),
		type: 'command',
		label: preset.label,
		command: preset.command,
		presetId,
	};
}

function createCanvasTab(title?: string): CanvasWorkspaceTab {
	return {
		id: generateId(),
		kind: 'canvas',
		title: title?.trim() || TAB_LABELS.canvas,
		blocks: {},
		layout: null,
		focusedBlockId: null,
		updatedAt: Date.now(),
	};
}

function createBlockTab(
	kind: Exclude<WorkspaceTabKind, 'canvas'>,
	title?: string,
): BlockWorkspaceTab {
	const block = createBlock(kind, title?.trim() || TAB_LABELS[kind]);
	return {
		id: generateId(),
		kind: 'block',
		title: title?.trim() || TAB_LABELS[kind],
		block,
		updatedAt: Date.now(),
	};
}

function createCommandPresetTab(presetId: CommandPresetId): BlockWorkspaceTab {
	const preset = getCommandPresetDefinition(presetId);
	const block = createCommandPresetBlock(presetId);
	return {
		id: generateId(),
		kind: 'block',
		title: preset.label,
		block,
		updatedAt: Date.now(),
	};
}

function createPendingTab(title?: string): PendingWorkspaceTab {
	return {
		id: generateId(),
		kind: 'pending',
		title: title?.trim() || 'New Tab',
		updatedAt: Date.now(),
	};
}

function createWorkspaceSurfaceState(): WorkspaceSurfaceState {
	const tab = createCanvasTab();
	return {
		tabs: { [tab.id]: tab },
		tabOrder: [tab.id],
		activeTabId: tab.id,
		updatedAt: Date.now(),
	};
}

function finalizeCanvasTabState(
	state: Omit<CanvasWorkspaceTab, 'updatedAt'>,
): CanvasWorkspaceTab {
	return {
		...state,
		updatedAt: Date.now(),
	};
}

function finalizeBlockTabState(
	state: Omit<BlockWorkspaceTab, 'updatedAt'>,
): BlockWorkspaceTab {
	return {
		...state,
		updatedAt: Date.now(),
	};
}

function finalizeWorkspaceSurfaceState(
	state: Omit<WorkspaceSurfaceState, 'updatedAt'>,
): WorkspaceSurfaceState {
	return {
		...state,
		updatedAt: Date.now(),
	};
}

function containsBlock(node: LayoutNode, blockId: string): boolean {
	if (node.kind === 'leaf') return node.blockId === blockId;
	return containsBlock(node.first, blockId) || containsBlock(node.second, blockId);
}

function getParentDirection(node: LayoutNode, targetId: string): SplitDirection | null {
	if (node.kind === 'leaf') return null;
	const inFirst = containsBlock(node.first, targetId);
	const inSecond = containsBlock(node.second, targetId);
	if (inFirst || inSecond) {
		const deeper = inFirst
			? getParentDirection(node.first, targetId)
			: getParentDirection(node.second, targetId);
		return deeper ?? node.direction;
	}
	return null;
}

function pickDirection(layout: LayoutNode | null, focusedId: string | null): SplitDirection {
	if (!layout || !focusedId) return 'horizontal';
	const parentDir = getParentDirection(layout, focusedId);
	if (parentDir === 'horizontal') return 'vertical';
	return 'horizontal';
}

function insertBlock(
	layout: LayoutNode | null,
	focusedId: string | null,
	blockId: string,
	direction?: SplitDirection,
): LayoutNode {
	const dir = direction ?? pickDirection(layout, focusedId);

	if (!layout) {
		return { kind: 'leaf', blockId };
	}

	if (!focusedId) {
		return {
			kind: 'split',
			id: generateId(),
			direction: dir,
			ratio: 0.5,
			first: layout,
			second: { kind: 'leaf', blockId },
		};
	}

	return splitAtLeaf(layout, focusedId, blockId, dir);
}

function splitAtLeaf(
	node: LayoutNode,
	targetId: string,
	newBlockId: string,
	direction: SplitDirection,
): LayoutNode {
	if (node.kind === 'leaf') {
		if (node.blockId === targetId) {
			return {
				kind: 'split',
				id: generateId(),
				direction,
				ratio: 0.5,
				first: node,
				second: { kind: 'leaf', blockId: newBlockId },
			};
		}
		return node;
	}

	return {
		...node,
		first: splitAtLeaf(node.first, targetId, newBlockId, direction),
		second: splitAtLeaf(node.second, targetId, newBlockId, direction),
	};
}

function removeFromLayout(node: LayoutNode, blockId: string): LayoutNode | null {
	if (node.kind === 'leaf') {
		return node.blockId === blockId ? null : node;
	}

	const first = removeFromLayout(node.first, blockId);
	const second = removeFromLayout(node.second, blockId);

	if (!first && !second) return null;
	if (!first) return second;
	if (!second) return first;

	return { ...node, first, second };
}

function updateSplitRatio(
	node: LayoutNode,
	splitId: string,
	ratio: number,
): LayoutNode {
	if (node.kind === 'leaf') return node;
	if (node.id === splitId) return { ...node, ratio };

	return {
		...node,
		first: updateSplitRatio(node.first, splitId, ratio),
		second: updateSplitRatio(node.second, splitId, ratio),
	};
}

function collectBlockIds(node: LayoutNode): string[] {
	if (node.kind === 'leaf') return [node.blockId];
	return [...collectBlockIds(node.first), ...collectBlockIds(node.second)];
}

function findSibling(node: LayoutNode, blockId: string): string | null {
	if (node.kind === 'leaf') return null;

	const inFirst = containsBlock(node.first, blockId);
	const inSecond = containsBlock(node.second, blockId);

	if (inFirst && node.first.kind === 'leaf' && node.first.blockId === blockId) {
		const ids = collectBlockIds(node.second);
		return ids[0] ?? null;
	}
	if (inSecond && node.second.kind === 'leaf' && node.second.blockId === blockId) {
		const ids = collectBlockIds(node.first);
		return ids[ids.length - 1] ?? null;
	}

	if (inFirst) return findSibling(node.first, blockId);
	if (inSecond) return findSibling(node.second, blockId);
	return null;
}

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function intervalOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
	return Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
}

function computeRects(
	node: LayoutNode,
	x: number,
	y: number,
	w: number,
	h: number,
): Map<string, Rect> {
	const map = new Map<string, Rect>();
	if (node.kind === 'leaf') {
		map.set(node.blockId, { x, y, w, h });
		return map;
	}

	if (node.direction === 'horizontal') {
		const w1 = w * node.ratio;
		const w2 = w - w1;
		for (const [key, value] of computeRects(node.first, x, y, w1, h)) map.set(key, value);
		for (const [key, value] of computeRects(node.second, x + w1, y, w2, h)) {
			map.set(key, value);
		}
	} else {
		const h1 = h * node.ratio;
		const h2 = h - h1;
		for (const [key, value] of computeRects(node.first, x, y, w, h1)) map.set(key, value);
		for (const [key, value] of computeRects(node.second, x, y + h1, w, h2)) {
			map.set(key, value);
		}
	}

	return map;
}

function isValidBlock(value: unknown): value is Block {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<Block>;
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.type === 'string' &&
		typeof candidate.label === 'string'
	);
}

function normalizeWorkspaceState(workspaceState: WorkspaceSurfaceState): WorkspaceSurfaceState {
	const nextTabs: Record<string, WorkspaceTabState> = {};

	for (const [tabId, tab] of Object.entries(workspaceState.tabs)) {
		if (!tab || typeof tab !== 'object') continue;
		if (tab.kind === 'canvas') {
			nextTabs[tabId] = {
				...tab,
				blocks: Object.fromEntries(
					Object.entries(tab.blocks ?? {}).filter(([, block]) => isValidBlock(block)),
				),
			};
			continue;
		}
		if (tab.kind === 'block' && isValidBlock(tab.block)) {
			nextTabs[tabId] = tab;
			continue;
		}
		if (tab.kind === 'pending') {
			nextTabs[tabId] = tab;
		}
	}

	const nextOrder = workspaceState.tabOrder.filter((tabId) => nextTabs[tabId]);
	if (nextOrder.length === 0) {
		return createWorkspaceSurfaceState();
	}

	return {
		tabs: nextTabs,
		tabOrder: nextOrder,
		activeTabId:
			workspaceState.activeTabId && nextTabs[workspaceState.activeTabId]
				? workspaceState.activeTabId
				: nextOrder[0] ?? null,
		updatedAt: workspaceState.updatedAt ?? Date.now(),
	};
}

function deriveActiveSurface(workspaceState: WorkspaceSurfaceState) {
	const normalizedState = normalizeWorkspaceState(workspaceState);
	const activeTab = normalizedState.activeTabId
		? normalizedState.tabs[normalizedState.activeTabId] ?? null
		: null;

	if (!activeTab) {
		return {
			activeTabId: null,
			activeTabKind: null,
			tabs: normalizedState.tabs,
			tabOrder: normalizedState.tabOrder,
			blocks: {},
			layout: null,
			focusedBlockId: null,
		};
	}

	if (activeTab.kind === 'canvas') {
		return {
			activeTabId: activeTab.id,
			activeTabKind: 'canvas' as const,
			tabs: normalizedState.tabs,
			tabOrder: normalizedState.tabOrder,
			blocks: activeTab.blocks,
			layout: activeTab.layout,
			focusedBlockId: activeTab.focusedBlockId,
		};
	}

	if (activeTab.kind === 'pending') {
		return {
			activeTabId: activeTab.id,
			activeTabKind: 'pending' as const,
			tabs: normalizedState.tabs,
			tabOrder: normalizedState.tabOrder,
			blocks: {},
			layout: null,
			focusedBlockId: null,
		};
	}

	return {
		activeTabId: activeTab.id,
		activeTabKind: 'block' as const,
		tabs: normalizedState.tabs,
		tabOrder: normalizedState.tabOrder,
		blocks: { [activeTab.block.id]: activeTab.block },
		layout: { kind: 'leaf' as const, blockId: activeTab.block.id },
		focusedBlockId: activeTab.block.id,
	};
}

function resolveWorkspaceState(
	workspaceStates: Record<string, WorkspaceSurfaceState>,
	workspaceId: string,
) {
	const workspaceState = workspaceStates[workspaceId];
	return workspaceState ? normalizeWorkspaceState(workspaceState) : createWorkspaceSurfaceState();
}

function applyWorkspaceState(
	state: CanvasState,
	workspaceId: string,
	workspaceState: WorkspaceSurfaceState,
): Partial<CanvasState> {
	const nextState: Partial<CanvasState> = {
		workspaceStates: {
			...state.workspaceStates,
			[workspaceId]: workspaceState,
		},
	};

	if (state.activeWorkspaceId !== workspaceId) {
		return nextState;
	}

	return {
		...nextState,
		...deriveActiveSurface(workspaceState),
	};
}

function ensureTabSelection(workspaceState: WorkspaceSurfaceState): WorkspaceSurfaceState {
	const normalizedState = normalizeWorkspaceState(workspaceState);
	if (normalizedState.tabOrder.length === 0) {
		return createWorkspaceSurfaceState();
	}
	if (
		normalizedState.activeTabId &&
		normalizedState.tabOrder.includes(normalizedState.activeTabId) &&
		normalizedState.tabs[normalizedState.activeTabId]
	) {
		return normalizedState;
	}
	if (workspaceState.tabOrder.length === 0) {
		return createWorkspaceSurfaceState();
	}
	if (
		workspaceState.activeTabId &&
		workspaceState.tabOrder.includes(workspaceState.activeTabId) &&
		workspaceState.tabs[workspaceState.activeTabId]
	) {
		return workspaceState;
	}
	return finalizeWorkspaceSurfaceState({
		tabs: normalizedState.tabs,
		tabOrder: normalizedState.tabOrder,
		activeTabId: normalizedState.tabOrder[0] ?? null,
	});
}

function migrateLegacyWorkspaceState(value: LegacyWorkspaceCanvasState): WorkspaceSurfaceState {
	const canvasTab = finalizeCanvasTabState({
		id: generateId(),
		kind: 'canvas',
		title: TAB_LABELS.canvas,
		blocks: value.blocks ?? {},
		layout: value.layout ?? null,
		focusedBlockId: value.focusedBlockId ?? null,
	});
	return finalizeWorkspaceSurfaceState({
		tabs: { [canvasTab.id]: canvasTab },
		tabOrder: [canvasTab.id],
		activeTabId: canvasTab.id,
	});
}

function updateActiveCanvasTab(
	workspaceState: WorkspaceSurfaceState,
	updater: (tab: CanvasWorkspaceTab) => CanvasWorkspaceTab,
): WorkspaceSurfaceState {
	const activeTab = workspaceState.activeTabId
		? workspaceState.tabs[workspaceState.activeTabId] ?? null
		: null;
	if (!activeTab || activeTab.kind !== 'canvas') {
		return workspaceState;
	}
	const nextTab = updater(activeTab);
	return finalizeWorkspaceSurfaceState({
		tabs: {
			...workspaceState.tabs,
			[nextTab.id]: nextTab,
		},
		tabOrder: workspaceState.tabOrder,
		activeTabId: workspaceState.activeTabId,
	});
}

function updateActiveBlockTab(
	workspaceState: WorkspaceSurfaceState,
	updater: (tab: BlockWorkspaceTab) => BlockWorkspaceTab,
): WorkspaceSurfaceState {
	const activeTab = workspaceState.activeTabId
		? workspaceState.tabs[workspaceState.activeTabId] ?? null
		: null;
	if (!activeTab || activeTab.kind !== 'block') {
		return workspaceState;
	}
	const nextTab = updater(activeTab);
	return finalizeWorkspaceSurfaceState({
		tabs: {
			...workspaceState.tabs,
			[nextTab.id]: nextTab,
		},
		tabOrder: workspaceState.tabOrder,
		activeTabId: workspaceState.activeTabId,
	});
}

export const useCanvasStore = create<CanvasState>()(
	persist(
		(set, get) => ({
			activeWorkspaceId: null,
			activeTabId: null,
			activeTabKind: null,
			workspaceStates: {},
			tabs: {},
			tabOrder: [],
			blocks: {},
			layout: null,
			focusedBlockId: null,

			activateWorkspace: (workspaceId) => {
				if (!workspaceId) {
					set({
						activeWorkspaceId: null,
						activeTabId: null,
						activeTabKind: null,
						tabs: {},
						tabOrder: [],
						blocks: {},
						layout: null,
						focusedBlockId: null,
					});
					return;
				}

				const workspaceState = ensureTabSelection(
					resolveWorkspaceState(get().workspaceStates, workspaceId),
				);
				set((state) => ({
					activeWorkspaceId: workspaceId,
					...deriveActiveSurface(workspaceState),
					workspaceStates: state.workspaceStates[workspaceId]
						? state.workspaceStates
						: { ...state.workspaceStates, [workspaceId]: workspaceState },
				}));
			},

			deleteWorkspaceState: (workspaceId) => {
				set((state) => {
					const nextStates = { ...state.workspaceStates };
					delete nextStates[workspaceId];
					if (state.activeWorkspaceId !== workspaceId) {
						return { workspaceStates: nextStates };
					}
					return {
						workspaceStates: nextStates,
						activeWorkspaceId: null,
						activeTabId: null,
						activeTabKind: null,
						tabs: {},
						tabOrder: [],
						blocks: {},
						layout: null,
						focusedBlockId: null,
					};
				});
			},

			openCreateTab: () => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const activeTab = workspaceState.activeTabId
					? workspaceState.tabs[workspaceState.activeTabId] ?? null
					: null;
				if (activeTab?.kind === 'pending') return;
				const tab = createPendingTab();
				const nextState = finalizeWorkspaceSurfaceState({
					tabs: {
						...workspaceState.tabs,
						[tab.id]: tab,
					},
					tabOrder: [...workspaceState.tabOrder, tab.id],
					activeTabId: tab.id,
				});
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
			},

			closeCreateTab: () => {
				const { activeWorkspaceId, activeTabId, workspaceStates } = get();
				if (!activeWorkspaceId || !activeTabId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const activeTab = workspaceState.tabs[activeTabId];
				if (!activeTab || activeTab.kind !== 'pending') return;
				get().removeTab(activeTabId);
			},

			setActiveTab: (tabId) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				if (!workspaceState.tabs[tabId]) return;
				const nextState = finalizeWorkspaceSurfaceState({
					tabs: workspaceState.tabs,
					tabOrder: workspaceState.tabOrder,
					activeTabId: tabId,
				});
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
			},

			createTab: (kind, title) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return null;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const tab = kind === 'canvas' ? createCanvasTab(title) : createBlockTab(kind, title);
				const activeTab = workspaceState.activeTabId
					? workspaceState.tabs[workspaceState.activeTabId] ?? null
					: null;
				if (activeTab?.kind === 'pending') {
					const nextTab =
						kind === 'canvas'
							? {
								...createCanvasTab(title),
								id: activeTab.id,
							}
							: {
								...createBlockTab(kind, title),
								id: activeTab.id,
							};
					const nextState = finalizeWorkspaceSurfaceState({
						tabs: {
							...workspaceState.tabs,
							[activeTab.id]: nextTab,
						},
						tabOrder: workspaceState.tabOrder,
						activeTabId: activeTab.id,
					});
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
					return activeTab.id;
				}
				const nextState = finalizeWorkspaceSurfaceState({
					tabs: {
						...workspaceState.tabs,
						[tab.id]: tab,
					},
					tabOrder: [...workspaceState.tabOrder, tab.id],
					activeTabId: tab.id,
				});
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				return tab.id;
			},

			createPresetTab: (presetId) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return null;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const tab = createCommandPresetTab(presetId);
				const activeTab = workspaceState.activeTabId
					? workspaceState.tabs[workspaceState.activeTabId] ?? null
					: null;
				if (activeTab?.kind === 'pending') {
					const nextTab = {
						...createCommandPresetTab(presetId),
						id: activeTab.id,
					};
					const nextState = finalizeWorkspaceSurfaceState({
						tabs: {
							...workspaceState.tabs,
							[activeTab.id]: nextTab,
						},
						tabOrder: workspaceState.tabOrder,
						activeTabId: activeTab.id,
					});
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
					return activeTab.id;
				}
				const nextState = finalizeWorkspaceSurfaceState({
					tabs: {
						...workspaceState.tabs,
						[tab.id]: tab,
					},
					tabOrder: [...workspaceState.tabOrder, tab.id],
					activeTabId: tab.id,
				});
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				return tab.id;
			},

			removeTab: (tabId) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				if (!workspaceState.tabs[tabId]) return;
				const nextTabs = { ...workspaceState.tabs };
				delete nextTabs[tabId];
				const nextOrder = workspaceState.tabOrder.filter((id) => id !== tabId);
				const nextState = ensureTabSelection(
					finalizeWorkspaceSurfaceState({
						tabs: nextTabs,
						tabOrder: nextOrder,
						activeTabId:
							workspaceState.activeTabId === tabId
								? (nextOrder[nextOrder.length - 1] ?? null)
								: workspaceState.activeTabId,
					}),
				);
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
			},

			setFocused: (id) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) =>
					finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: tab.layout,
						focusedBlockId: id,
					}),
				);
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			addBlock: (type, label, direction) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = createBlock(type, label);
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: { ...tab.blocks, [block.id]: block },
						layout: insertBlock(tab.layout, tab.focusedBlockId, block.id, direction),
						focusedBlockId: block.id,
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			addPresetBlock: (presetId, direction) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = createCommandPresetBlock(presetId);
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: { ...tab.blocks, [block.id]: block },
						layout: insertBlock(tab.layout, tab.focusedBlockId, block.id, direction),
						focusedBlockId: block.id,
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			convertBlock: (id, type) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: {
								...block,
								type,
								label: LABELS[type],
								url: type === 'browser' ? block.url ?? '' : undefined,
								reloadToken: type === 'browser' ? block.reloadToken ?? 0 : undefined,
								sessionId: type === 'otto' ? block.sessionId : undefined,
								command: type === 'command' ? block.command ?? '' : undefined,
								cwd: type === 'command' ? block.cwd : undefined,
								presetId: undefined,
							},
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id) return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: LABELS[type],
						block: {
							...tab.block,
							type,
							label: LABELS[type],
							url: type === 'browser' ? tab.block.url ?? '' : undefined,
							reloadToken: type === 'browser' ? tab.block.reloadToken ?? 0 : undefined,
							sessionId: type === 'otto' ? tab.block.sessionId : undefined,
							command: type === 'command' ? tab.block.command ?? '' : undefined,
							cwd: type === 'command' ? tab.block.cwd : undefined,
							presetId: undefined,
						},
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			convertBlockToPreset: (id, presetId) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const preset = getCommandPresetDefinition(presetId);
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: {
								...block,
								type: 'command',
								label: preset.label,
								command: preset.command,
								cwd: block.cwd,
								url: undefined,
								reloadToken: undefined,
								sessionId: undefined,
								presetId,
							},
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id) return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: preset.label,
						block: {
							...tab.block,
							type: 'command',
							label: preset.label,
							command: preset.command,
							cwd: tab.block.cwd,
							url: undefined,
							reloadToken: undefined,
							sessionId: undefined,
							presetId,
						},
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			setBlockUrl: (id, url) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: { ...block, url },
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id) return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						block: { ...tab.block, url },
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			setBlockSessionId: (id, sessionId) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: {
								...block,
								sessionId: sessionId ?? undefined,
							},
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id) return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						block: {
							...tab.block,
							sessionId: sessionId ?? undefined,
						},
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			setCommandBlockConfig: (id, config) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextLabel = config.label?.trim() || config.command.trim() || LABELS.command;
				const nextCommand = config.command.trim();
				const nextCwd = config.cwd?.trim() || undefined;
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block || block.type !== 'command') return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: {
								...block,
								label: nextLabel,
								command: nextCommand,
								cwd: nextCwd,
								presetId: undefined,
							},
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id || tab.block.type !== 'command') return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: nextLabel,
						block: {
							...tab.block,
							label: nextLabel,
							command: nextCommand,
							cwd: nextCwd,
							presetId: undefined,
						},
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			reloadBlock: (id) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const canvasState = updateActiveCanvasTab(workspaceState, (tab) => {
					const block = tab.blocks[id];
					if (!block || block.type !== 'browser') return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: {
							...tab.blocks,
							[id]: {
								...block,
								reloadToken: (block.reloadToken ?? 0) + 1,
							},
						},
						layout: tab.layout,
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (canvasState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, canvasState));
					return;
				}
				const blockState = updateActiveBlockTab(workspaceState, (tab) => {
					if (tab.block.id !== id || tab.block.type !== 'browser') return tab;
					return finalizeBlockTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						block: {
							...tab.block,
							reloadToken: (tab.block.reloadToken ?? 0) + 1,
						},
					});
				});
				if (blockState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, blockState));
				}
			},

			removeBlock: (id) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const activeTab = workspaceState.activeTabId
					? workspaceState.tabs[workspaceState.activeTabId] ?? null
					: null;
				if (!activeTab) return;

				if (activeTab.kind === 'block' && activeTab.block.id === id) {
					get().removeTab(activeTab.id);
					return;
				}

				if (activeTab.kind !== 'canvas') return;

				let nextFocus: string | null = null;
				if (activeTab.layout) {
					nextFocus = findSibling(activeTab.layout, id);
				}

				const nextBlocks = { ...activeTab.blocks };
				delete nextBlocks[id];
				const nextLayout = activeTab.layout ? removeFromLayout(activeTab.layout, id) : null;
				const remaining = nextLayout ? collectBlockIds(nextLayout) : [];
				if (!nextFocus || !remaining.includes(nextFocus)) {
					nextFocus = remaining[0] ?? null;
				}

				const nextState = updateActiveCanvasTab(workspaceState, (tab) =>
					finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: nextBlocks,
						layout: nextLayout,
						focusedBlockId: nextFocus,
					}),
				);
				set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
			},

			setSplitRatio: (splitId, ratio) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					if (!tab.layout) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: updateSplitRatio(tab.layout, splitId, ratio),
						focusedBlockId: tab.focusedBlockId,
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			focusNext: () => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					if (!tab.layout) return tab;
					const ids = collectBlockIds(tab.layout);
					if (ids.length === 0) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: tab.layout,
						focusedBlockId:
							ids[(ids.indexOf(tab.focusedBlockId ?? '') + 1 + ids.length) % ids.length],
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			focusPrev: () => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					if (!tab.layout) return tab;
					const ids = collectBlockIds(tab.layout);
					if (ids.length === 0) return tab;
					const idx = tab.focusedBlockId ? ids.indexOf(tab.focusedBlockId) : 0;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: tab.layout,
						focusedBlockId: ids[(idx - 1 + ids.length) % ids.length],
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			focusByIndex: (index) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					if (!tab.layout) return tab;
					const ids = collectBlockIds(tab.layout);
					if (index >= ids.length) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: tab.layout,
						focusedBlockId: ids[index],
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},

			focusDirection: (dir) => {
				const { activeWorkspaceId, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const workspaceState = resolveWorkspaceState(workspaceStates, activeWorkspaceId);
				const nextState = updateActiveCanvasTab(workspaceState, (tab) => {
					if (!tab.layout || !tab.focusedBlockId) return tab;
					const rects = computeRects(tab.layout, 0, 0, 1, 1);
					const source = rects.get(tab.focusedBlockId);
					if (!source) return tab;

					const sourceCenterX = source.x + source.w / 2;
					const sourceCenterY = source.y + source.h / 2;
					const sourceRight = source.x + source.w;
					const sourceBottom = source.y + source.h;
					const epsilon = 0.0001;

					let best: string | null = null;
					let bestPrimary = Infinity;
					let bestSecondary = Infinity;

					for (const [candidateId, rect] of rects) {
						if (candidateId === tab.focusedBlockId) continue;

						const overlap =
							dir === 'left' || dir === 'right'
								? intervalOverlap(source.y, sourceBottom, rect.y, rect.y + rect.h)
								: intervalOverlap(source.x, sourceRight, rect.x, rect.x + rect.w);
						if (overlap <= epsilon) continue;

						let primaryGap: number | null = null;
						if (dir === 'left' && rect.x + rect.w <= source.x + epsilon) {
							primaryGap = source.x - (rect.x + rect.w);
						}
						if (dir === 'right' && rect.x >= sourceRight - epsilon) {
							primaryGap = rect.x - sourceRight;
						}
						if (dir === 'up' && rect.y + rect.h <= source.y + epsilon) {
							primaryGap = source.y - (rect.y + rect.h);
						}
						if (dir === 'down' && rect.y >= sourceBottom - epsilon) {
							primaryGap = rect.y - sourceBottom;
						}
						if (primaryGap === null) continue;

						const secondaryDistance =
							dir === 'left' || dir === 'right'
								? Math.abs(rect.y + rect.h / 2 - sourceCenterY)
								: Math.abs(rect.x + rect.w / 2 - sourceCenterX);

						if (
							primaryGap < bestPrimary ||
							(primaryGap === bestPrimary && secondaryDistance < bestSecondary)
						) {
							bestPrimary = primaryGap;
							bestSecondary = secondaryDistance;
							best = candidateId;
						}
					}

					if (!best) return tab;
					return finalizeCanvasTabState({
						id: tab.id,
						kind: tab.kind,
						title: tab.title,
						blocks: tab.blocks,
						layout: tab.layout,
						focusedBlockId: best,
					});
				});
				if (nextState !== workspaceState) {
					set((state) => applyWorkspaceState(state, activeWorkspaceId, nextState));
				}
			},
		}),
		{
			name: 'otto-canvas-layouts',
			version: 3,
			migrate: (persistedState) => {
				const state = persistedState as
					| Partial<CanvasState>
					| { workspaceStates?: Record<string, WorkspaceSurfaceState | LegacyWorkspaceCanvasState> }
					| undefined;
				if (!state?.workspaceStates) {
					return { workspaceStates: {} };
				}

				const workspaceStates = Object.fromEntries(
					Object.entries(state.workspaceStates).map(([workspaceId, workspaceState]) => {
						if ('tabs' in workspaceState && 'tabOrder' in workspaceState) {
							return [workspaceId, ensureTabSelection(workspaceState as WorkspaceSurfaceState)];
						}
						return [
							workspaceId,
							migrateLegacyWorkspaceState(workspaceState as LegacyWorkspaceCanvasState),
						];
					}),
				);

				return { workspaceStates };
			},
			partialize: (state) => ({
				workspaceStates: state.workspaceStates,
			}),
			onRehydrateStorage: () => () => {
				const activeWorkspaceId = useWorkspaceStore.getState().activeId;
				useCanvasStore.getState().activateWorkspace(activeWorkspaceId);
			},
		},
	),
);
