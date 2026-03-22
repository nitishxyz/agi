import { invoke } from '@tauri-apps/api/core';

export interface GhosttyStatus {
	available: boolean;
	message: string;
	appPath?: string | null;
}

let statusPromise: Promise<GhosttyStatus> | null = null;

export function isTauriRuntime() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getGhosttyStatus() {
	if (!isTauriRuntime()) {
		return {
			available: false,
			message: 'Ghostty blocks require the Canvas Tauri app runtime.',
		} satisfies GhosttyStatus;
	}

	statusPromise ??= invoke<GhosttyStatus>('ghostty_status').catch((error) => {
		statusPromise = null;
		throw error;
	});

	return statusPromise;
}

export async function createGhosttyBlock(blockId: string, cwd?: string, command?: string) {
	return invoke('ghostty_create_block', {
		blockId,
		cwd,
		command,
	});
}

export async function updateGhosttyBlock(
	blockId: string,
	payload: {
		x: number;
		y: number;
		width: number;
		height: number;
		viewportHeight: number;
		scaleFactor: number;
		focused: boolean;
	},
) {
	return invoke('ghostty_update_block', {
		blockId,
		...payload,
	});
}

export async function inputGhosttyText(blockId: string, text: string) {
	return invoke('ghostty_input_text', { blockId, text });
}

export async function inputGhosttyKey(
	blockId: string,
	payload: {
		keycode: number;
		mods: number;
		text?: string | null;
		composing?: boolean;
		action?: 'press' | 'repeat';
	},
) {
	return invoke('ghostty_input_key', {
		blockId,
		...payload,
	});
}

export async function setGhosttyBlockFocus(blockId: string, focused: boolean) {
	return invoke('ghostty_set_block_focus', { blockId, focused });
}

export async function destroyGhosttyBlock(blockId: string) {
	return invoke('ghostty_destroy_block', { blockId });
}
