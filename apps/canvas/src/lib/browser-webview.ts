import { invoke } from '@tauri-apps/api/core';

export interface BrowserWebviewRect {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportHeight: number;
	focused: boolean;
}

export async function createBrowserWebview(
	blockId: string,
	url: string,
	userAgent?: string,
) {
	return invoke('browser_create_block', {
		blockId,
		url,
		userAgent,
	});
}

export async function updateBrowserWebviewBounds(
	blockId: string,
	rect: BrowserWebviewRect,
) {
	return invoke('browser_update_block', {
		blockId,
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height,
		viewportHeight: rect.viewportHeight,
		focused: rect.focused,
	});
}

export async function navigateBrowserWebview(blockId: string, url: string) {
	return invoke('browser_navigate_block', {
		blockId,
		url,
	});
}

export async function reloadBrowserWebview(blockId: string) {
	return invoke('browser_reload_block', { blockId });
}

export async function destroyBrowserWebview(blockId: string) {
	return invoke('browser_destroy_block', { blockId });
}
