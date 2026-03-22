import { create } from 'zustand';

export type BlockType = 'terminal' | 'browser' | 'otto' | 'pending';
export type SplitDirection = 'horizontal' | 'vertical';

export interface Block {
	id: string;
	type: BlockType;
	label: string;
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

interface CanvasState {
	blocks: Record<string, Block>;
	layout: LayoutNode | null;
	focusedBlockId: string | null;
	setFocused: (id: string) => void;
	addBlock: (type: BlockType, label?: string, direction?: SplitDirection) => void;
	convertBlock: (id: string, type: BlockType) => void;
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

function removeFromLayout(
	node: LayoutNode,
	blockId: string,
): LayoutNode | null {
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
	terminal: 'Terminal',
	browser: 'Browser',
	otto: 'Otto',
	pending: 'New Block',
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
	blocks: {},
	layout: null,
	focusedBlockId: null,

	setFocused: (id) => set({ focusedBlockId: id }),

	addBlock: (type, label, direction) => {
		const id = generateId();
		const block: Block = {
			id,
			type,
			label: label ?? LABELS[type],
		};
		const { layout, focusedBlockId } = get();
		set({
			blocks: { ...get().blocks, [id]: block },
			layout: insertBlock(layout, focusedBlockId, id, direction),
			focusedBlockId: id,
		});
	},

	convertBlock: (id, type) => {
		const block = get().blocks[id];
		if (!block) return;
		set({
			blocks: {
				...get().blocks,
				[id]: { ...block, type, label: LABELS[type] },
			},
		});
	},

	removeBlock: (id) => {
		const { blocks, layout } = get();

		let nextFocus: string | null = null;
		if (layout) {
			nextFocus = findSibling(layout, id);
		}

		const newBlocks = { ...blocks };
		delete newBlocks[id];
		const newLayout = layout ? removeFromLayout(layout, id) : null;
		const remaining = newLayout ? collectBlockIds(newLayout) : [];

		if (!nextFocus || !remaining.includes(nextFocus)) {
			nextFocus = remaining[0] ?? null;
		}

		set({
			blocks: newBlocks,
			layout: newLayout,
			focusedBlockId: nextFocus,
		});
	},

	setSplitRatio: (splitId, ratio) => {
		const { layout } = get();
		if (layout) {
			set({ layout: updateSplitRatio(layout, splitId, ratio) });
		}
	},

	focusNext: () => {
		const { layout, focusedBlockId } = get();
		if (!layout) return;
		const ids = collectBlockIds(layout);
		if (ids.length === 0) return;
		const idx = focusedBlockId ? ids.indexOf(focusedBlockId) : -1;
		set({ focusedBlockId: ids[(idx + 1) % ids.length] });
	},

	focusPrev: () => {
		const { layout, focusedBlockId } = get();
		if (!layout) return;
		const ids = collectBlockIds(layout);
		if (ids.length === 0) return;
		const idx = focusedBlockId ? ids.indexOf(focusedBlockId) : 1;
		set({ focusedBlockId: ids[(idx - 1 + ids.length) % ids.length] });
	},

	focusByIndex: (index) => {
		const { layout } = get();
		if (!layout) return;
		const ids = collectBlockIds(layout);
		if (index < ids.length) {
			set({ focusedBlockId: ids[index] });
		}
	},

	focusDirection: (dir) => {
		const { layout, focusedBlockId } = get();
		if (!layout || !focusedBlockId) return;
		const rects = computeRects(layout, 0, 0, 1, 1);
		const source = rects.get(focusedBlockId);
		if (!source) return;

		const cx = source.x + source.w / 2;
		const cy = source.y + source.h / 2;

		let best: string | null = null;
		let bestDist = Infinity;

		for (const [id, r] of rects) {
			if (id === focusedBlockId) continue;
			const rx = r.x + r.w / 2;
			const ry = r.y + r.h / 2;

			let valid = false;
			if (dir === 'left' && rx < cx) valid = true;
			if (dir === 'right' && rx > cx) valid = true;
			if (dir === 'up' && ry < cy) valid = true;
			if (dir === 'down' && ry > cy) valid = true;
			if (!valid) continue;

			const primaryDist = dir === 'left' || dir === 'right' ? Math.abs(rx - cx) : Math.abs(ry - cy);
			const crossDist = dir === 'left' || dir === 'right' ? Math.abs(ry - cy) : Math.abs(rx - cx);
			const dist = primaryDist + crossDist * 0.5;

			if (dist < bestDist) {
				bestDist = dist;
				best = id;
			}
		}

		if (best) set({ focusedBlockId: best });
	},
}));

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

interface Rect { x: number; y: number; w: number; h: number }

function computeRects(
	node: LayoutNode,
	x: number, y: number, w: number, h: number,
): Map<string, Rect> {
	const map = new Map<string, Rect>();
	if (node.kind === 'leaf') {
		map.set(node.blockId, { x, y, w, h });
		return map;
	}

	if (node.direction === 'horizontal') {
		const w1 = w * node.ratio;
		const w2 = w - w1;
		for (const [k, v] of computeRects(node.first, x, y, w1, h)) map.set(k, v);
		for (const [k, v] of computeRects(node.second, x + w1, y, w2, h)) map.set(k, v);
	} else {
		const h1 = h * node.ratio;
		const h2 = h - h1;
		for (const [k, v] of computeRects(node.first, x, y, w, h1)) map.set(k, v);
		for (const [k, v] of computeRects(node.second, x, y + h1, w, h2)) map.set(k, v);
	}

	return map;
}
