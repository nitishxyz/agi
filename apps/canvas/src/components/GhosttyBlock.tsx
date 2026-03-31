import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	createGhosttyVtSession,
	destroyGhosttyVtSession,
	getGhosttyVtStatus,
	inputGhosttyVtKey,
	resizeGhosttyVtSession,
	scrollGhosttyVtViewport,
	sendGhosttyVtText,
	snapshotGhosttyVtSession,
	type GhosttyVtRgb,
	type GhosttyVtSnapshot,
	type GhosttyVtStatus,
} from '../lib/ghostty-vt';
import { isTauriRuntime } from '../lib/ghostty';
import {
	useNativeBlockHost,
	useNativeBlockRuntime,
} from '../lib/native-block-runtime';
import { loadNerdFont, NERD_FONT_FAMILY } from '../lib/nerd-font';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useTabActivityStore } from '../stores/tab-activity-store';
import { useWorkspaceStore } from '../stores/workspace-store';

interface GhosttyBlockProps {
	block: Block;
	isFocused: boolean;
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_CELL_WIDTH_PX = 8;
const DEFAULT_CELL_HEIGHT_PX = 16;

function estimateCols(width: number) {
	return Math.max(2, Math.floor(width / DEFAULT_CELL_WIDTH_PX));
}

function estimateRows(height: number) {
	return Math.max(1, Math.floor(height / DEFAULT_CELL_HEIGHT_PX));
}

function getScrollDelta(event: React.WheelEvent<HTMLDivElement>) {
	const direction = Math.sign(event.deltaY);
	if (direction === 0) return 0;
	if (event.deltaMode === 1) {
		return direction * Math.min(3, Math.max(1, Math.round(Math.abs(event.deltaY) / 2)));
	}
	if (event.deltaMode === 2) {
		return direction * 8;
	}
	return direction * Math.min(2, Math.max(1, Math.round(Math.abs(event.deltaY) / 80)));
}

function rgbToCss(color?: GhosttyVtRgb | null) {
	if (!color) return 'transparent';
	return `rgb(${color.r} ${color.g} ${color.b})`;
}

function drawSnapshotToCanvas(
	canvas: HTMLCanvasElement,
	snapshot: GhosttyVtSnapshot,
	fontReady: boolean,
) {
	const rect = canvas.getBoundingClientRect();
	const width = Math.max(1, Math.floor(rect.width));
	const height = Math.max(1, Math.floor(rect.height));
	const dpr = window.devicePixelRatio || 1;
	const nextWidth = Math.max(1, Math.floor(width * dpr));
	const nextHeight = Math.max(1, Math.floor(height * dpr));
	if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
		canvas.width = nextWidth;
		canvas.height = nextHeight;
	}

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, width, height);

	const defaultBg = rgbToCss(snapshot.defaultBg);
	const defaultFg = rgbToCss(snapshot.defaultFg);
	ctx.fillStyle = defaultBg;
	ctx.fillRect(0, 0, width, height);

	const cellWidth = width / Math.max(1, snapshot.cols);
	const cellHeight = height / Math.max(1, snapshot.rows);
	const fontSize = Math.max(11, Math.floor(cellHeight * 0.82));
	const fontFamily = fontReady ? NERD_FONT_FAMILY : '"IBM Plex Mono", monospace';
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';

	let currentFont = '';
	const applyFont = (bold: boolean, italic: boolean) => {
		const nextFont = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;
		if (nextFont === currentFont) return;
		currentFont = nextFont;
		ctx.font = nextFont;
	};

	for (let rowIndex = 0; rowIndex < snapshot.rowsData.length; rowIndex += 1) {
		const row = snapshot.rowsData[rowIndex];
		const y = rowIndex * cellHeight;
		for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex += 1) {
			const cell = row.cells[cellIndex];
			const x = cellIndex * cellWidth;
			const bg = cell.bg ? rgbToCss(cell.bg) : defaultBg;
			if (bg !== defaultBg) {
				ctx.fillStyle = bg;
				ctx.fillRect(x, y, Math.ceil(cellWidth + 0.5), Math.ceil(cellHeight + 0.5));
			}

			const isCursor =
				snapshot.cursor.visible &&
				snapshot.cursor.x === cellIndex &&
				snapshot.cursor.y === rowIndex;

			let textColor = cell.fg ? rgbToCss(cell.fg) : defaultFg;
			let textBg = bg;
			if (isCursor && snapshot.cursor.shape === 'block') {
				textColor = bg;
				textBg = cell.fg ? rgbToCss(cell.fg) : defaultFg;
				ctx.fillStyle = textBg;
				ctx.fillRect(x, y, Math.ceil(cellWidth + 0.5), Math.ceil(cellHeight + 0.5));
			} else if (isCursor && snapshot.cursor.shape === 'hollow-block') {
				ctx.strokeStyle = 'rgba(255,255,255,0.96)';
				ctx.lineWidth = 1;
				ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, cellWidth - 1), Math.max(0, cellHeight - 1));
			} else if (isCursor && snapshot.cursor.shape === 'underline') {
				ctx.fillStyle = 'rgba(255,255,255,0.96)';
				ctx.fillRect(x, y + cellHeight - 2, Math.ceil(cellWidth), 2);
			} else if (isCursor && snapshot.cursor.shape === 'bar') {
				ctx.fillStyle = 'rgba(255,255,255,0.96)';
				ctx.fillRect(x, y, 2, Math.ceil(cellHeight));
			}

			const text = cell.invisible ? ' ' : cell.text || ' ';
			applyFont(cell.bold, cell.italic);
			ctx.fillStyle = textColor;
			ctx.globalAlpha = cell.dim ? 0.72 : 1;
			ctx.fillText(text, x, y + Math.max(0, (cellHeight - fontSize) / 2));
			ctx.globalAlpha = 1;

			if (cell.underline) {
				ctx.fillRect(x, y + cellHeight - 1.5, Math.ceil(cellWidth), 1);
			}
			if (cell.strikethrough) {
				ctx.fillRect(x, y + cellHeight / 2, Math.ceil(cellWidth), 1);
			}
		}
	}
}

export function GhosttyBlock({ block, isFocused }: GhosttyBlockProps) {
	const setFocused = useCanvasStore((s) => s.setFocused);
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
	const workspaces = useWorkspaceStore((s) => s.workspaces);
	const environments = useWorkspaceStore((s) => s.environments);
	const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
	const activeEnvironment = activeWorkspace
		? environments[activeWorkspace.primaryEnvironmentId] ?? null
		: null;
	const nativeMode = isTauriRuntime();
	const nativeHostRef = useNativeBlockHost(block.id, 'terminal');
	const nativeRuntime = useNativeBlockRuntime(block.id);
	const hostRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const refreshTimeoutRef = useRef<number | null>(null);
	const [status, setStatus] = useState<GhosttyVtStatus | null>(null);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [snapshot, setSnapshot] = useState<GhosttyVtSnapshot | null>(null);
	const [runtimeError, setRuntimeError] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [fontReady, setFontReady] = useState(false);
	const [loading, setLoading] = useState(true);
	const cwdOverride = block.cwd?.trim() || undefined;
	const workspaceRoot = activeEnvironment?.path?.trim() || undefined;
	const startupCommand =
		block.type === 'command' ? block.command?.trim() || undefined : undefined;
	const setActivityStatus = useTabActivityStore((s) => s.setStatus);
	const activityRef = useRef<{
		timestamps: number[];
		idleTimer: number | null;
		isBusy: boolean;
	}>({ timestamps: [], idleTimer: null, isBusy: false });

	useEffect(() => {
		if (!isTauriRuntime()) return;
		let unlisten: (() => void) | undefined;
		const BURST_THRESHOLD = 6;
		const BURST_WINDOW_MS = 800;
		const IDLE_DELAY_MS = 2000;

		const onUpdate = () => {
			const ctx = activityRef.current;
			const now = Date.now();
			ctx.timestamps.push(now);
			const cutoff = now - BURST_WINDOW_MS;
			ctx.timestamps = ctx.timestamps.filter((t) => t > cutoff);

			if (ctx.idleTimer !== null) {
				window.clearTimeout(ctx.idleTimer);
			}
			ctx.idleTimer = window.setTimeout(() => {
				ctx.idleTimer = null;
				ctx.isBusy = false;
				ctx.timestamps = [];
				setActivityStatus(block.id, 'idle');
			}, IDLE_DELAY_MS);

			if (ctx.timestamps.length >= BURST_THRESHOLD && !ctx.isBusy) {
				ctx.isBusy = true;
				setActivityStatus(block.id, 'busy', 'Running…');
			}
		};

		void listen<{ sessionId: string }>('ghostty-vt-updated', (event) => {
			if (event.payload.sessionId === block.id) onUpdate();
		}).then((dispose) => {
			unlisten = dispose;
		});
		return () => {
			unlisten?.();
			const ctx = activityRef.current;
			if (ctx.idleTimer !== null) {
				window.clearTimeout(ctx.idleTimer);
			}
			ctx.isBusy = false;
			setActivityStatus(block.id, 'idle');
		};
	}, [block.id, setActivityStatus]);

	const refreshSnapshot = useCallback(async () => {
		const nextSnapshot = await snapshotGhosttyVtSession(block.id);
		setSnapshot(nextSnapshot);
		return nextSnapshot;
	}, [block.id]);

	const scheduleRefresh = useCallback(
		(delay = 0) => {
			if (refreshTimeoutRef.current !== null) {
				window.clearTimeout(refreshTimeoutRef.current);
			}
			refreshTimeoutRef.current = window.setTimeout(() => {
				refreshTimeoutRef.current = null;
				void refreshSnapshot().catch(() => undefined);
			}, delay);
		},
		[refreshSnapshot],
	);

	useEffect(() => {
		if (nativeMode) return;
		void loadNerdFont().finally(() => setFontReady(true));
	}, [nativeMode]);

	useEffect(() => {
		if (nativeMode || !snapshot || !canvasRef.current) return;
		const canvas = canvasRef.current;
		const frame = window.requestAnimationFrame(() => {
			drawSnapshotToCanvas(canvas, snapshot, fontReady);
		});
		return () => {
			window.cancelAnimationFrame(frame);
		};
	}, [fontReady, nativeMode, snapshot]);

	useEffect(() => {
		if (nativeMode) return;
		if (!isTauriRuntime()) {
			setStatus({
				available: false,
				message: 'Terminal blocks require the Canvas Tauri app runtime.',
			});
			return;
		}

		let cancelled = false;
		void getGhosttyVtStatus()
			.then((nextStatus) => {
				if (cancelled) return;
				setStatus(nextStatus);
			})
			.catch((error) => {
				if (cancelled) return;
				setStatusError(error instanceof Error ? error.message : String(error));
			});

		return () => {
			cancelled = true;
		};
	}, [nativeMode]);

	useEffect(() => {
		if (nativeMode || !status?.available) return;

		let cancelled = false;
		setLoading(true);
		setReady(false);
		setRuntimeError(null);
		setSnapshot(null);

		void (async () => {
			try {
				await destroyGhosttyVtSession(block.id).catch(() => undefined);
				await createGhosttyVtSession(block.id, {
					cwd: cwdOverride,
					workspaceRoot,
					command: startupCommand,
					cols: DEFAULT_COLS,
					rows: DEFAULT_ROWS,
				});
				if (cancelled) {
					await destroyGhosttyVtSession(block.id).catch(() => undefined);
					return;
				}
				setReady(true);
				setLoading(false);
				scheduleRefresh(0);
				return;
			} catch (error) {
				if (cancelled) return;
				setRuntimeError(error instanceof Error ? error.message : String(error));
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
			setReady(false);
			if (refreshTimeoutRef.current !== null) {
				window.clearTimeout(refreshTimeoutRef.current);
				refreshTimeoutRef.current = null;
			}
			void destroyGhosttyVtSession(block.id).catch(() => undefined);
		};
	}, [
		block.id,
		cwdOverride,
		nativeMode,
		scheduleRefresh,
		startupCommand,
		status?.available,
		workspaceRoot,
	]);

	useEffect(() => {
		if (nativeMode || !ready) return;
		let unlisten: (() => void) | undefined;
		void listen<{ sessionId: string }>('ghostty-vt-updated', (event) => {
			if (event.payload.sessionId !== block.id) return;
			scheduleRefresh(0);
		}).then((dispose) => {
			unlisten = dispose;
		});

		return () => {
			unlisten?.();
		};
	}, [block.id, nativeMode, ready, scheduleRefresh]);

	useEffect(() => {
		if (nativeMode || !ready) return;
		const interval = window.setInterval(() => {
			void refreshSnapshot().catch(() => undefined);
		}, 1000);
		return () => {
			window.clearInterval(interval);
		};
	}, [nativeMode, ready, refreshSnapshot]);

	useEffect(() => {
		if (nativeMode) return;
		const element = hostRef.current;
		if (!ready || !element) return;

		const resize = () => {
			const rect = element.getBoundingClientRect();
			const cols = estimateCols(rect.width);
			const rows = estimateRows(rect.height);
			void resizeGhosttyVtSession(block.id, {
				cols,
				rows,
				cellWidthPx: DEFAULT_CELL_WIDTH_PX,
				cellHeightPx: DEFAULT_CELL_HEIGHT_PX,
			})
				.then(() => scheduleRefresh(10))
				.catch(() => undefined);
			if (canvasRef.current && snapshot) {
				drawSnapshotToCanvas(canvasRef.current, snapshot, fontReady);
			}
		};

		resize();
		const observer = new ResizeObserver(() => resize());
		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, [block.id, fontReady, nativeMode, ready, scheduleRefresh, snapshot]);

	useEffect(() => {
		if (!isFocused || nativeMode) return;
		hostRef.current?.focus();
	}, [isFocused, nativeMode]);

	const sendText = useCallback(
		(text: string) => {
			if (!text) return;
			void sendGhosttyVtText(block.id, text)
				.then(() => {
					scheduleRefresh(0);
				})
				.catch((error) => {
					setRuntimeError(error instanceof Error ? error.message : String(error));
				});
		},
		[block.id, scheduleRefresh],
	);

	const sendKey = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.metaKey && (event.key === 'c' || event.key === 'v' || event.key === 'x')) {
				return;
			}
			if (event.key === 'Process') {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			void inputGhosttyVtKey(block.id, {
				code: event.code,
				key: event.key,
				text:
					event.key.length === 1 && !event.ctrlKey && !event.metaKey
						? event.key
						: null,
				ctrl: event.ctrlKey,
				alt: event.altKey,
				shift: event.shiftKey,
				meta: event.metaKey,
				repeat: event.repeat,
			})
				.then(() => {
					scheduleRefresh(0);
				})
				.catch((error) => {
					setRuntimeError(error instanceof Error ? error.message : String(error));
				});
		},
		[block.id, scheduleRefresh],
	);

	const unavailableMessage = useMemo(() => {
		if (statusError) return statusError;
		if (runtimeError) return runtimeError;
		if (!status) return 'Checking libghostty-vt availability…';
		if (!status.available) return status.message;
		return null;
	}, [runtimeError, status, statusError]);

	const defaultBg = snapshot?.defaultBg ?? { r: 6, g: 7, b: 8 };

	if (nativeMode) {
		return (
			<div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[#060708]">
				<div
					ref={nativeHostRef}
					className="h-full w-full"
					onMouseDown={(event) => {
						event.stopPropagation();
						setFocused(block.id);
					}}
				/>
				{(nativeRuntime.loading || nativeRuntime.error) && (
					<div className="absolute inset-0 flex items-center justify-center bg-[#09090b]/80 px-6 text-center backdrop-blur-sm">
						<div className="max-w-[360px] space-y-2">
							<p className="text-[12px] font-medium text-canvas-text-dim">
								{nativeRuntime.loading ? 'Starting terminal…' : 'Terminal unavailable'}
							</p>
							<p className="text-[11px] leading-5 text-canvas-text-muted">
								{nativeRuntime.loading
									? 'Launching a native macOS terminal surface for this block.'
									: nativeRuntime.error}
							</p>
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[#060708]">
			<div
				ref={hostRef}
				tabIndex={0}
				className="h-full w-full outline-none"
				style={{ background: rgbToCss(defaultBg) }}
				onFocus={() => setFocused(block.id)}
				onMouseDown={(event) => {
					event.stopPropagation();
					setFocused(block.id);
				}}
				onPaste={(event) => {
					const text = event.clipboardData.getData('text/plain');
					if (!text) return;
					event.preventDefault();
					event.stopPropagation();
					sendText(text);
				}}
				onWheel={(event) => {
					event.preventDefault();
					event.stopPropagation();
					const delta = getScrollDelta(event);
					if (delta === 0) return;
					void scrollGhosttyVtViewport(block.id, delta)
						.then(() => scheduleRefresh(0))
						.catch(() => undefined);
				}}
				onKeyDown={sendKey}
			>
				<canvas ref={canvasRef} className="block h-full w-full" />
			</div>

			{(loading || unavailableMessage) && (
				<div className="absolute inset-0 flex items-center justify-center bg-[#09090b]/90 px-6 text-center backdrop-blur-sm">
					<div className="max-w-[360px] space-y-2">
						<p className="text-[12px] font-medium text-canvas-text-dim">
							{loading ? 'Starting terminal…' : 'Terminal unavailable'}
						</p>
						<p className="text-[11px] leading-5 text-canvas-text-muted">
							{loading ? 'Launching a libghostty-vt session for this block.' : unavailableMessage}
						</p>
					</div>
				</div>
			)}

			{ready && snapshot && (
				<div className="pointer-events-none absolute right-3 bottom-2 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
					{snapshot.cols}×{snapshot.rows}
					{snapshot.processAlive ? ' • running' : ' • exited'}
				</div>
			)}
		</div>
	);
}
