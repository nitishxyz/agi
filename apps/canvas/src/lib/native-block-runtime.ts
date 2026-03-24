import { useCallback, useSyncExternalStore } from 'react';

export type NativeBlockKind = 'terminal' | 'browser';

interface NativeBlockHostEntry {
	blockId: string;
	kind: NativeBlockKind;
	element: HTMLElement;
}

export interface NativeBlockRuntimeState {
	loading: boolean;
	error: string | null;
}

const DEFAULT_RUNTIME_STATE: NativeBlockRuntimeState = {
	loading: false,
	error: null,
};

const hostEntries = new Map<string, NativeBlockHostEntry>();
const runtimeStates = new Map<string, NativeBlockRuntimeState>();
const listeners = new Set<() => void>();
const hostListeners = new Set<() => void>();

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

function emitHostChange() {
	for (const listener of hostListeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function subscribeNativeBlockHosts(listener: () => void) {
	hostListeners.add(listener);
	return () => {
		hostListeners.delete(listener);
	};
}

function getSnapshot(blockId: string): NativeBlockRuntimeState {
	return runtimeStates.get(blockId) ?? DEFAULT_RUNTIME_STATE;
}

export function getNativeBlockHost(blockId: string) {
	return hostEntries.get(blockId) ?? null;
}

export function registerNativeBlockHost(
	blockId: string,
	kind: NativeBlockKind,
	element: HTMLElement,
) {
	const current = hostEntries.get(blockId);
	if (current && current.kind === kind && current.element === element) return;
	hostEntries.set(blockId, { blockId, kind, element });
	emitHostChange();
}

export function unregisterNativeBlockHost(
	blockId: string,
	element?: HTMLElement | null,
) {
	const current = hostEntries.get(blockId);
	if (!current) return;
	if (element && current.element !== element) return;
	hostEntries.delete(blockId);
	emitHostChange();
}

export function useNativeBlockHost(blockId: string, kind: NativeBlockKind) {
	return useCallback(
		(node: HTMLElement | null) => {
			if (node) {
				registerNativeBlockHost(blockId, kind, node);
				return;
			}
			unregisterNativeBlockHost(blockId);
		},
		[blockId, kind],
	);
}

export function setNativeBlockRuntimeState(
	blockId: string,
	partial: Partial<NativeBlockRuntimeState>,
) {
	const previous = runtimeStates.get(blockId) ?? DEFAULT_RUNTIME_STATE;
	const next: NativeBlockRuntimeState = {
		...previous,
		...partial,
	};

	if (
		previous.loading === next.loading &&
		previous.error === next.error
	) {
		return;
	}

	runtimeStates.set(blockId, next);
	emitChange();
}

export function clearNativeBlockRuntimeState(blockId: string) {
	if (!runtimeStates.delete(blockId)) return;
	emitChange();
}

export function useNativeBlockRuntime(blockId: string) {
	return useSyncExternalStore(
		subscribe,
		() => getSnapshot(blockId),
		() => DEFAULT_RUNTIME_STATE,
	);
}
