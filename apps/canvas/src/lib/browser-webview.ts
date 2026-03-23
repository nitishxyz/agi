import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import { Webview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface BrowserWebviewRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

const CREATE_TIMEOUT_MS = 1500;

export function getBrowserUserAgent(baseUserAgent: string) {
	if (!baseUserAgent) return undefined;

	const isMacWebKitWithoutBrowserToken =
		baseUserAgent.includes('Macintosh') &&
		baseUserAgent.includes('AppleWebKit/') &&
		!baseUserAgent.includes('Safari/') &&
		!baseUserAgent.includes('Chrome/') &&
		!baseUserAgent.includes('Chromium/') &&
		!baseUserAgent.includes('Edg/');

	if (!isMacWebKitWithoutBrowserToken) {
		return baseUserAgent;
	}

	const webkitVersion =
		baseUserAgent.match(/AppleWebKit\/([\d.]+)/)?.[1] ?? '605.1.15';

	return `${baseUserAgent} Version/17.0 Safari/${webkitVersion}`;
}

function getLabel(blockId: string) {
	return `browser_${blockId}`;
}

function normalizeRect(rect: BrowserWebviewRect) {
	return {
		x: Math.round(rect.x),
		y: Math.round(rect.y),
		width: Math.max(1, Math.round(rect.width)),
		height: Math.max(1, Math.round(rect.height)),
	};
}

export async function destroyBrowserWebview(blockId: string) {
	const existing = await Webview.getByLabel(getLabel(blockId));
	if (!existing) return;
	await existing.close().catch(() => {
		console.debug('[browser] failed to close child webview', { blockId });
	});
}

export async function createBrowserWebview(
	blockId: string,
	url: string,
	rect: BrowserWebviewRect,
	focused = false,
	userAgent?: string,
) {
	await destroyBrowserWebview(blockId);

	const normalizedRect = normalizeRect(rect);
	const webview = new Webview(getCurrentWindow(), getLabel(blockId), {
		url,
		x: normalizedRect.x,
		y: normalizedRect.y,
		width: normalizedRect.width,
		height: normalizedRect.height,
		focus: focused,
		dragDropEnabled: false,
		acceptFirstMouse: true,
		userAgent,
	});

	await new Promise<void>((resolve, reject) => {
		let finished = false;
		const finish = (callback: () => void) => {
			if (finished) return;
			finished = true;
			callback();
		};

		void webview.once('tauri://created', () => {
			finish(resolve);
		});

		void webview.once('tauri://error', (event) => {
			finish(() => {
				reject(
					new Error(
						typeof event.payload === 'string'
							? event.payload
							: 'Failed to create browser webview.',
					),
				);
			});
		});

		window.setTimeout(() => {
			finish(resolve);
		}, CREATE_TIMEOUT_MS);
	});

	return webview;
}

export async function updateBrowserWebviewBounds(
	webview: Webview,
	rect: BrowserWebviewRect,
) {
	const normalizedRect = normalizeRect(rect);
	await Promise.all([
		webview.setPosition(
			new LogicalPosition(normalizedRect.x, normalizedRect.y),
		),
		webview.setSize(
			new LogicalSize(normalizedRect.width, normalizedRect.height),
		),
	]);
}
