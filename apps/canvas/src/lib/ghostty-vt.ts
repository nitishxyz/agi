import { invoke } from '@tauri-apps/api/core';

export interface GhosttyVtStatus {
	available: boolean;
	message: string;
	sourceDir?: string | null;
	libDir?: string | null;
}

export interface GhosttyVtRgb {
	r: number;
	g: number;
	b: number;
}

export interface GhosttyVtCell {
	text: string;
	fg?: GhosttyVtRgb | null;
	bg?: GhosttyVtRgb | null;
	bold: boolean;
	italic: boolean;
	dim: boolean;
	underline: boolean;
	strikethrough: boolean;
	invisible: boolean;
}

export interface GhosttyVtRow {
	cells: GhosttyVtCell[];
}

export interface GhosttyVtCursor {
	visible: boolean;
	blinking: boolean;
	x?: number | null;
	y?: number | null;
	shape: string;
}

export interface GhosttyVtSnapshot {
	sessionId: string;
	cols: number;
	rows: number;
	screenText: string;
	rowsData: GhosttyVtRow[];
	defaultFg: GhosttyVtRgb;
	defaultBg: GhosttyVtRgb;
	cursor: GhosttyVtCursor;
	processAlive: boolean;
	exitStatus?: number | null;
}

export async function getGhosttyVtStatus() {
	return invoke<GhosttyVtStatus>('ghostty_vt_status');
}

export async function createGhosttyVtSession(
	sessionId: string,
	payload?: {
		cwd?: string;
		command?: string;
		cols?: number;
		rows?: number;
	},
) {
	return invoke('ghostty_vt_create_session', {
		sessionId,
		cwd: payload?.cwd,
		command: payload?.command,
		cols: payload?.cols,
		rows: payload?.rows,
	});
}

export async function resizeGhosttyVtSession(
	sessionId: string,
	payload: {
		cols: number;
		rows: number;
		cellWidthPx?: number;
		cellHeightPx?: number;
	},
) {
	return invoke('ghostty_vt_resize_session', {
		sessionId,
		...payload,
	});
}

export async function sendGhosttyVtText(sessionId: string, text: string) {
	return invoke('ghostty_vt_send_text', { sessionId, text });
}

export async function inputGhosttyVtKey(
	sessionId: string,
	payload: {
		code: string;
		key: string;
		text?: string | null;
		ctrl: boolean;
		alt: boolean;
		shift: boolean;
		meta: boolean;
		repeat: boolean;
	},
) {
	return invoke('ghostty_vt_input_key', {
		sessionId,
		...payload,
	});
}

export async function scrollGhosttyVtViewport(sessionId: string, delta: number) {
	return invoke('ghostty_vt_scroll_viewport', { sessionId, delta });
}

export async function snapshotGhosttyVtSession(sessionId: string) {
	return invoke<GhosttyVtSnapshot>('ghostty_vt_snapshot_session', { sessionId });
}

export async function destroyGhosttyVtSession(sessionId: string) {
	return invoke('ghostty_vt_destroy_session', { sessionId });
}
