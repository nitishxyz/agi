import { invoke } from '@tauri-apps/api/core';

export interface NativeTerminalRect {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportHeight: number;
	focused: boolean;
	hidden?: boolean;
}

export interface NativeTerminalStatus {
	available: boolean;
	message: string;
	mode: string;
}

export async function getNativeTerminalStatus() {
	return invoke<NativeTerminalStatus>('native_terminal_status');
}

export async function createNativeTerminalBlock(
	blockId: string,
	cwd?: string,
	workspaceRoot?: string,
	command?: string,
) {
	return invoke('native_terminal_create_block', {
		blockId,
		cwd,
		workspaceRoot,
		command,
	});
}

export async function updateNativeTerminalBlock(
	blockId: string,
	rect: NativeTerminalRect,
) {
	return invoke('native_terminal_update_block', {
		blockId,
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height,
		viewportHeight: rect.viewportHeight,
		focused: rect.focused,
		hidden: rect.hidden,
	});
}

export async function destroyNativeTerminalBlock(blockId: string) {
	return invoke('native_terminal_destroy_block', { blockId });
}
