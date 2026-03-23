import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useWorkspaceStore } from './workspace-store';

export type BlockType = 'terminal' | 'browser' | 'otto' | 'pending';
export type SplitDirection = 'horizontal' | 'vertical';

export interface Block {
	id: string;
	type: BlockType;
	label: string;
	url?: string;
	reloadToken?: number;
	sessionId?: string;
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

export interface WorkspaceCanvasState {
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	updatedAt: number;
}

interface CanvasState {
	activeWorkspaceId: string | null;
	workspaceStates: Record<string, WorkspaceCanvasState>;
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	activateWorkspace: (workspaceId: string | null) => void;
	deleteWorkspaceState: (workspaceId: string) => void;
	setFocused: (id: string) => void;
	addBlock: (type: BlockType, label?: string, direction?: SplitDirection) => void;
	convertBlock: (id: string, type: BlockType) => void;
	setBlockUrl: (id: string, url: string) => void;
	setBlockSessionId: (id: string, sessionId: string | null) => void;
	reloadBlock: (id: string) => void;
	removeBlock: (id: string) => void;
	setSplitRatio: (splitId: string, ratio: number) => void;
	focusNext: () => void;
	focusPrev: () => void;
	focusByIndex: (index: number) => void;
	focusDirection: (dir: 'left' | 'right' | 'up' | 'down') => void;
}

function generateId() {
	return crypto.randomUUID().slice(0, 8);
}

function createEmptyWorkspaceState(): WorkspaceCanvasState {
	return {
		blocks: {},
		layout: null,
		focusedBlockId: null,
		updatedAt: Date.now(),
	};
}

function finalizeWorkspaceState(
	state: Omit<WorkspaceCanvasState, 'updatedAt'>,
): WorkspaceCanvasState {
	return {
		...state,
		updatedAt: Date.now(),
	};
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

function containsBlock(node: LayoutNode, blockId: string): boolean {
	if (node.kind === 'leaf') return node.blockId === blockId;
	return containsBlock(node.first, blockId) || containsBlock(node.second, blockId);
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

const LABELS: Record<BlockType, string> = {
	terminal: 'Ghostty',
	browser: 'Browser',
	otto: 'Otto',
	pending: 'New Block',
};

function resolveWorkspaceState(
	workspaceStates: Record<string, WorkspaceCanvasState>,
	workspaceId: string,
) {
	return workspaceStates[workspaceId] ?? createEmptyWorkspaceState();
}

export const useCanvasStore = create<CanvasState>()(
	persist(
		(set, get) => ({
			activeWorkspaceId: null,
			workspaceStates: {},
			blocks: {},
			layout: null,
			focusedBlockId: null,

			activateWorkspace: (workspaceId) => {
				if (!workspaceId) {
					set({
						activeWorkspaceId: null,
						blocks: {},
						layout: null,
						focusedBlockId: null,
					});
					return;
				}

				const workspaceState = resolveWorkspaceState(get().workspaceStates, workspaceId);
				set((state) => ({
					activeWorkspaceId: workspaceId,
					blocks: workspaceState.blocks,
					layout: workspaceState.layout,
					focusedBlockId: workspaceState.focusedBlockId,
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
						blocks: {},
						layout: null,
						focusedBlockId: null,
					};
				});
			},

			setFocused: (id) => {
				const { activeWorkspaceId, blocks, layout, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout,
					focusedBlockId: id,
				});
				set({
					focusedBlockId: id,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			addBlock: (type, label, direction) => {
				const { activeWorkspaceId, layout, focusedBlockId, blocks, workspaceStates } = get();
				if (!activeWorkspaceId) return;
				const id = generateId();
				const block: Block = {
					id,
					type,
					label: label ?? LABELS[type],
					url: type === 'browser' ? '' : undefined,
					reloadToken: type === 'browser' ? 0 : undefined,
				};
				const nextState = finalizeWorkspaceState({
					blocks: { ...blocks, [id]: block },
					layout: insertBlock(layout, focusedBlockId, id, direction),
					focusedBlockId: id,
				});
				set({
					blocks: nextState.blocks,
					layout: nextState.layout,
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			convertBlock: (id, type) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				const block = blocks[id];
				if (!activeWorkspaceId || !block) return;
				const nextState = finalizeWorkspaceState({
					blocks: {
						...blocks,
						[id]: {
							...block,
							type,
							label: LABELS[type],
							url: type === 'browser' ? block.url ?? '' : undefined,
							reloadToken: type === 'browser' ? block.reloadToken ?? 0 : undefined,
							sessionId: type === 'otto' ? block.sessionId : undefined,
						},
					},
					layout,
					focusedBlockId,
				});
				set({
					blocks: nextState.blocks,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			setBlockUrl: (id, url) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				const block = blocks[id];
				if (!activeWorkspaceId || !block) return;
				const nextState = finalizeWorkspaceState({
					blocks: {
						...blocks,
						[id]: { ...block, url },
					},
					layout,
					focusedBlockId,
				});
				set({
					blocks: nextState.blocks,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			setBlockSessionId: (id, sessionId) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				const block = blocks[id];
				if (!activeWorkspaceId || !block) return;
				const nextState = finalizeWorkspaceState({
					blocks: {
						...blocks,
						[id]: {
							...block,
							sessionId: sessionId ?? undefined,
						},
					},
					layout,
					focusedBlockId,
				});
				set({
					blocks: nextState.blocks,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			reloadBlock: (id) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				const block = blocks[id];
				if (!activeWorkspaceId || !block || block.type !== 'browser') return;
				const nextState = finalizeWorkspaceState({
					blocks: {
						...blocks,
						[id]: {
							...block,
							reloadToken: (block.reloadToken ?? 0) + 1,
						},
					},
					layout,
					focusedBlockId,
				});
				set({
					blocks: nextState.blocks,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			removeBlock: (id) => {
				const { activeWorkspaceId, blocks, layout, workspaceStates } = get();
				if (!activeWorkspaceId) return;

				let nextFocus: string | null = null;
				if (layout) {
					nextFocus = findSibling(layout, id);
				}

				const nextBlocks = { ...blocks };
				delete nextBlocks[id];
				const nextLayout = layout ? removeFromLayout(layout, id) : null;
				const remaining = nextLayout ? collectBlockIds(nextLayout) : [];

				if (!nextFocus || !remaining.includes(nextFocus)) {
					nextFocus = remaining[0] ?? null;
				}

				const nextState = finalizeWorkspaceState({
					blocks: nextBlocks,
					layout: nextLayout,
					focusedBlockId: nextFocus,
				});
				set({
					blocks: nextState.blocks,
					layout: nextState.layout,
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			setSplitRatio: (splitId, ratio) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				if (!activeWorkspaceId || !layout) return;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout: updateSplitRatio(layout, splitId, ratio),
					focusedBlockId,
				});
				set({
					layout: nextState.layout,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			focusNext: () => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				if (!activeWorkspaceId || !layout) return;
				const ids = collectBlockIds(layout);
				if (ids.length === 0) return;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout,
					focusedBlockId: ids[(ids.indexOf(focusedBlockId ?? '') + 1 + ids.length) % ids.length],
				});
				set({
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			focusPrev: () => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				if (!activeWorkspaceId || !layout) return;
				const ids = collectBlockIds(layout);
				if (ids.length === 0) return;
				const idx = focusedBlockId ? ids.indexOf(focusedBlockId) : 0;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout,
					focusedBlockId: ids[(idx - 1 + ids.length) % ids.length],
				});
				set({
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			focusByIndex: (index) => {
				const { activeWorkspaceId, blocks, layout, workspaceStates } = get();
				if (!activeWorkspaceId || !layout) return;
				const ids = collectBlockIds(layout);
				if (index >= ids.length) return;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout,
					focusedBlockId: ids[index],
				});
				set({
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},

			focusDirection: (dir) => {
				const { activeWorkspaceId, blocks, layout, focusedBlockId, workspaceStates } = get();
				if (!activeWorkspaceId || !layout || !focusedBlockId) return;
				const rects = computeRects(layout, 0, 0, 1, 1);
				const source = rects.get(focusedBlockId);
				if (!source) return;

				const sourceCenterX = source.x + source.w / 2;
				const sourceCenterY = source.y + source.h / 2;
				const sourceRight = source.x + source.w;
				const sourceBottom = source.y + source.h;
				const epsilon = 0.0001;

				let best: string | null = null;
				let bestPrimary = Infinity;
				let bestSecondary = Infinity;

				for (const [id, rect] of rects) {
					if (id === focusedBlockId) continue;

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
						best = id;
					}
				}

				if (!best) return;
				const nextState = finalizeWorkspaceState({
					blocks,
					layout,
					focusedBlockId: best,
				});
				set({
					focusedBlockId: nextState.focusedBlockId,
					workspaceStates: {
						...workspaceStates,
						[activeWorkspaceId]: nextState,
					},
				});
			},
		}),
		{
			name: 'otto-canvas-layouts',
			version: 2,
			migrate: (persistedState) => {
				const state = persistedState as Partial<CanvasState> | undefined;
				if (!state?.workspaceStates) {
					return { workspaceStates: {} };
				}
				return { workspaceStates: state.workspaceStates };
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
		for (const [key, value] of computeRects(node.second, x + w1, y, w2, h))
			map.set(key, value);
	} else {
		const h1 = h * node.ratio;
		const h2 = h - h1;
		for (const [key, value] of computeRects(node.first, x, y, w, h1)) map.set(key, value);
		for (const [key, value] of computeRects(node.second, x, y + h1, w, h2))
			map.set(key, value);
	}

	return map;
}
